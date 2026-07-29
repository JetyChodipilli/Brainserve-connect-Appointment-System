package com.brainserve.appointment.document.application;

import com.brainserve.appointment.audit.api.AuditService;
import com.brainserve.appointment.document.api.DocumentEvents;
import com.brainserve.appointment.document.api.ProfilePhotoStore;
import com.brainserve.appointment.document.domain.DocumentStatus;
import com.brainserve.appointment.document.domain.StoredDocument;
import com.brainserve.appointment.document.infrastructure.ClamAvScanner;
import com.brainserve.appointment.document.infrastructure.StoredDocumentRepository;
import com.brainserve.appointment.shared.application.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class DocumentService implements ProfilePhotoStore {
    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png", "application/pdf");
    private final StoredDocumentRepository documents;
    private final ClamAvScanner scanner;
    private final S3Client s3;
    private final S3Presigner presigner;
    private final AuditService audit;
    private final ApplicationEventPublisher events;
    private final String bucket;
    private final long maxBytes;
    private final long urlMinutes;

    public DocumentService(StoredDocumentRepository documents, ClamAvScanner scanner, S3Client s3, S3Presigner presigner,
                           AuditService audit, ApplicationEventPublisher events,
                           @Value("${brainserve.document.bucket}") String bucket,
                           @Value("${brainserve.document.max-bytes}") long maxBytes,
                           @Value("${brainserve.document.download-url-minutes}") long urlMinutes) {
        this.documents = documents; this.scanner = scanner; this.s3 = s3; this.presigner = presigner;
        this.audit = audit; this.events = events; this.bucket = bucket; this.maxBytes = maxBytes; this.urlMinutes = urlMinutes;
    }

    @Transactional
    public StoredDocument upload(String ownerType, UUID ownerId, String category, MultipartFile file) {
        validate(file);
        try {
            byte[] bytes = file.getBytes();
            scanner.assertClean(bytes);
            String objectKey = ownerType.toLowerCase() + "/" + ownerId + "/" + UUID.randomUUID();
            String digest = sha256(bytes);
            s3.putObject(PutObjectRequest.builder().bucket(bucket).key(objectKey).contentType(file.getContentType())
                    .metadata(java.util.Map.of("sha256", digest)).build(), RequestBody.fromBytes(bytes));
            StoredDocument stored;
            try {
                stored = documents.saveAndFlush(new StoredDocument(ownerType.toUpperCase(), ownerId, category.toUpperCase(),
                        objectKey, safeFilename(file.getOriginalFilename()), file.getContentType(), bytes.length,
                        digest, DocumentStatus.CLEAN));
            } catch (RuntimeException ex) {
                s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(objectKey).build());
                throw ex;
            }
            audit.record("DOCUMENT_UPLOAD", ownerType.toUpperCase(), ownerId.toString(), "{\"category\":\"" + category.toUpperCase() + "\"}");
            events.publishEvent(new DocumentEvents.DocumentUploaded(stored.getId(), ownerType.toUpperCase(), ownerId, category.toUpperCase(), Instant.now()));
            return stored;
        } catch (IOException ex) {
            throw new BusinessException("DOCUMENT_READ_FAILED", "The uploaded file could not be read", HttpStatus.BAD_REQUEST);
        }
    }

    @Transactional(readOnly = true)
    public StoredDocument get(UUID id) {
        return documents.findById(id).filter(value -> value.getStatus() == DocumentStatus.CLEAN)
                .orElseThrow(() -> new BusinessException("DOCUMENT_NOT_FOUND", "Document was not found", HttpStatus.NOT_FOUND));
    }

    @Transactional(readOnly = true)
    public List<StoredDocument> list(String ownerType, UUID ownerId) {
        return documents.findByOwnerTypeAndOwnerIdOrderByCreatedAtDesc(ownerType.toUpperCase(), ownerId).stream()
                .filter(value -> value.getStatus() == DocumentStatus.CLEAN).toList();
    }

    public String createDownloadUrl(UUID id) {
        StoredDocument document = get(id);
        var request = GetObjectRequest.builder().bucket(bucket).key(document.getObjectKey())
                .responseContentDisposition("attachment; filename=\"" + safeFilename(document.getOriginalFilename()) + "\"").build();
        String url = presigner.presignGetObject(GetObjectPresignRequest.builder().signatureDuration(Duration.ofMinutes(urlMinutes))
                .getObjectRequest(request).build()).url().toString();
        audit.record("DOCUMENT_READ", document.getOwnerType(), document.getOwnerId().toString(), "{\"documentId\":\"" + id + "\"}");
        return url;
    }

    @Override
    @Transactional
    public ProfilePhoto save(UUID userId, MultipartFile file) {
        if (file.getContentType() == null || !Set.of("image/jpeg", "image/png").contains(file.getContentType())) {
            throw new BusinessException("PROFILE_PHOTO_TYPE_NOT_ALLOWED",
                    "Profile photos must be JPEG or PNG images", HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        }
        StoredDocument stored = upload("ACCOUNT", userId, "PROFILE_PHOTO", file);
        documents.findByOwnerTypeAndOwnerIdOrderByCreatedAtDesc("ACCOUNT", userId).stream()
                .filter(value -> !value.getId().equals(stored.getId()))
                .filter(value -> value.getStatus() == DocumentStatus.CLEAN)
                .filter(value -> "PROFILE_PHOTO".equals(value.getCategory()))
                .forEach(value -> {
                    try { s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(value.getObjectKey()).build()); }
                    catch (RuntimeException ignored) { /* the database still retires the old photo */ }
                    value.delete();
                });
        return toProfilePhoto(stored);
    }

    @Override
    @Transactional(readOnly = true)
    public java.util.Optional<ProfilePhoto> current(UUID userId) {
        return documents.findFirstByOwnerTypeAndOwnerIdAndCategoryAndStatusOrderByCreatedAtDesc(
                "ACCOUNT", userId, "PROFILE_PHOTO", DocumentStatus.CLEAN).map(this::toProfilePhoto);
    }

    @Override
    @Transactional(readOnly = true)
    public ProfilePhotoAccess createAccess(UUID documentId) {
        StoredDocument document = get(documentId);
        if (!"ACCOUNT".equals(document.getOwnerType()) || !"PROFILE_PHOTO".equals(document.getCategory())) {
            throw new BusinessException("PROFILE_PHOTO_NOT_FOUND", "Profile photo was not found", HttpStatus.NOT_FOUND);
        }
        var request = GetObjectRequest.builder().bucket(bucket).key(document.getObjectKey())
                .responseContentDisposition("inline; filename=\"" + safeFilename(document.getOriginalFilename()) + "\"").build();
        String url = presigner.presignGetObject(GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(urlMinutes)).getObjectRequest(request).build()).url().toString();
        return new ProfilePhotoAccess(url, Instant.now().plus(Duration.ofMinutes(urlMinutes)));
    }

    @Transactional
    public void delete(UUID id) {
        StoredDocument document = get(id);
        s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(document.getObjectKey()).build());
        document.delete();
        audit.record("DOCUMENT_DELETE", document.getOwnerType(), document.getOwnerId().toString(), "{\"documentId\":\"" + id + "\"}");
    }

    private void validate(MultipartFile file) {
        if (file.isEmpty()) throw new BusinessException("EMPTY_DOCUMENT", "A non-empty file is required", HttpStatus.BAD_REQUEST);
        if (file.getSize() > maxBytes) throw new BusinessException("DOCUMENT_TOO_LARGE", "File exceeds the configured size limit", HttpStatus.PAYLOAD_TOO_LARGE);
        if (file.getContentType() == null || !ALLOWED_TYPES.contains(file.getContentType()))
            throw new BusinessException("DOCUMENT_TYPE_NOT_ALLOWED", "Only JPEG, PNG and PDF files are accepted", HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
    private String safeFilename(String value) {
        String name = value == null ? "document" : value.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[^A-Za-z0-9._-]", "_");
        return name.isBlank() ? "document" : name.substring(0, Math.min(name.length(), 180));
    }
    private String sha256(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }

    private ProfilePhoto toProfilePhoto(StoredDocument value) {
        return new ProfilePhoto(value.getId(), value.getOriginalFilename(), value.getContentType(),
                value.getSizeBytes(), value.getCreatedAt());
    }
}
