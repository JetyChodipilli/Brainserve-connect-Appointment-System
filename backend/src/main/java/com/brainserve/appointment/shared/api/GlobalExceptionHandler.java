package com.brainserve.appointment.shared.api;

import com.brainserve.appointment.shared.application.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.catalina.connector.ClientAbortException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log =
            LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BusinessException.class)
    public ProblemDetail business(
            BusinessException ex,
            HttpServletRequest request
    ) {
        return problem(
                ex.getStatus(),
                ex.getErrorCode(),
                ex.getMessage(),
                request,
                null
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail validation(
            MethodArgumentNotValidException ex,
            HttpServletRequest request
    ) {
        List<Map<String, String>> errors =
                ex.getBindingResult()
                        .getFieldErrors()
                        .stream()
                        .map(this::fieldError)
                        .toList();

        return problem(
                HttpStatus.BAD_REQUEST,
                "VALIDATION_FAILED",
                "One or more fields are invalid",
                request,
                errors
        );
    }

    /**
     * Handles invalid path variables and request parameters.
     *
     * Example:
     * /users/demo-hr-admin where a UUID is required.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ProblemDetail typeMismatch(
            MethodArgumentTypeMismatchException ex,
            HttpServletRequest request
    ) {
        String parameterName =
                ex.getName() == null
                        ? "parameter"
                        : ex.getName();

        List<Map<String, String>> errors = List.of(
                Map.of(
                        "field",
                        parameterName,
                        "message",
                        "Invalid value"
                )
        );

        return problem(
                HttpStatus.BAD_REQUEST,
                "INVALID_REQUEST_PARAMETER",
                "The request parameter '" + parameterName
                        + "' has an invalid value",
                request,
                errors
        );
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail conflict(
            DataIntegrityViolationException ex,
            HttpServletRequest request
    ) {
        log.warn(
                "Database conflict correlationId={} path={}",
                correlationId(),
                request.getRequestURI()
        );

        log.debug(
                "Database conflict details correlationId={}",
                correlationId(),
                ex
        );

        return problem(
                HttpStatus.CONFLICT,
                "DATA_CONFLICT",
                "The request conflicts with an existing record",
                request,
                null
        );
    }

    @ExceptionHandler(RedisConnectionFailureException.class)
    public ProblemDetail redisUnavailable(
            RedisConnectionFailureException ex,
            HttpServletRequest request
    ) {
        log.warn(
                "Redis unavailable correlationId={} path={}",
                correlationId(),
                request.getRequestURI()
        );

        log.debug(
                "Redis connection failure details correlationId={}",
                correlationId(),
                ex
        );

        return problem(
                HttpStatus.SERVICE_UNAVAILABLE,
                "SECURITY_STATE_UNAVAILABLE",
                "The security state service is temporarily unavailable",
                request,
                null
        );
    }

    /**
     * Handles method-level authorization failures such as @PreAuthorize.
     */
    @ExceptionHandler(AuthorizationDeniedException.class)
    public ProblemDetail authorizationDenied(
            AuthorizationDeniedException ex,
            HttpServletRequest request
    ) {
        log.warn(
                "Access denied correlationId={} path={}",
                correlationId(),
                request.getRequestURI()
        );

        return problem(
                HttpStatus.FORBIDDEN,
                "ACCESS_DENIED",
                "You do not have permission to perform this operation",
                request,
                null
        );
    }

    /**
     * Browsers normally close SSE connections during refresh, logout,
     * navigation or temporary network interruption.
     *
     * The SSE response may already be committed, so a ProblemDetail
     * response must not be written.
     */
    @ExceptionHandler({
            AsyncRequestNotUsableException.class,
            ClientAbortException.class
    })
    public void disconnectedClient(
            Exception ex,
            HttpServletRequest request
    ) {
        logDisconnectedClient(request);
    }

    /**
     * Keep this as the final handler because it catches every remaining
     * exception.
     */
    @ExceptionHandler(Exception.class)
    public ProblemDetail unexpected(
            Exception ex,
            HttpServletRequest request
    ) {
        /*
         * Client-disconnection exceptions can sometimes be wrapped inside
         * IOException or another servlet exception. Do not attempt to write
         * a JSON response after an SSE response has already been committed.
         */
        if (isDisconnectedClient(ex)) {
            logDisconnectedClient(request);
            return null;
        }

        log.error(
                "Unhandled request failure correlationId={} path={}",
                correlationId(),
                request.getRequestURI(),
                ex
        );

        return problem(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "The request could not be completed",
                request,
                null
        );
    }

    private ProblemDetail problem(
            HttpStatus status,
            String code,
            String detail,
            HttpServletRequest request,
            List<Map<String, String>> fieldErrors
    ) {
        ProblemDetail problem =
                ProblemDetail.forStatusAndDetail(status, detail);

        problem.setType(
                URI.create(
                        "https://brainserve.in/problems/"
                                + code.toLowerCase(Locale.ROOT)
                                .replace('_', '-')
                )
        );

        problem.setTitle(status.getReasonPhrase());
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("errorCode", code);
        problem.setProperty("timestamp", Instant.now());
        problem.setProperty("correlationId", correlationId());

        if (fieldErrors != null && !fieldErrors.isEmpty()) {
            problem.setProperty("fieldErrors", fieldErrors);
        }

        return problem;
    }

    private Map<String, String> fieldError(FieldError error) {
        return Map.of(
                "field",
                error.getField(),
                "message",
                error.getDefaultMessage() == null
                        ? "Invalid value"
                        : error.getDefaultMessage()
        );
    }

    private boolean isDisconnectedClient(Throwable throwable) {
        Throwable current = throwable;

        while (current != null) {
            if (current instanceof ClientAbortException
                    || current instanceof AsyncRequestNotUsableException) {
                return true;
            }

            if (current instanceof IOException
                    && hasDisconnectMessage(current.getMessage())) {
                return true;
            }

            current = current.getCause();
        }

        return false;
    }

    private boolean hasDisconnectMessage(String message) {
        if (message == null) {
            return false;
        }

        String normalized = message.toLowerCase(Locale.ROOT);

        return normalized.contains("broken pipe")
                || normalized.contains("connection reset")
                || normalized.contains("connection aborted")
                || normalized.contains("connection was aborted")
                || normalized.contains("forcibly closed")
                || normalized.contains("response is no longer usable");
    }

    private void logDisconnectedClient(
            HttpServletRequest request
    ) {
        log.debug(
                "Client connection closed correlationId={} path={}",
                correlationId(),
                request.getRequestURI()
        );
    }

    private String correlationId() {
        return MDC.get("correlationId");
    }
}