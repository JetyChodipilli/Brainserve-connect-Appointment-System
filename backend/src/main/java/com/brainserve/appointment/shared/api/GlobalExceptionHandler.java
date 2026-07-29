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

import java.net.URI;
import java.time.Instant;
import java.util.List;
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

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail conflict(
            DataIntegrityViolationException ex,
            HttpServletRequest request
    ) {
        log.warn(
                "Database conflict correlationId={} path={}",
                MDC.get("correlationId"),
                request.getRequestURI()
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
                MDC.get("correlationId"),
                request.getRequestURI()
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
                MDC.get("correlationId"),
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
     * A browser may close an SSE connection during refresh, navigation,
     * logout or network interruption. The response is already committed,
     * so no ProblemDetail response must be written.
     */
    @ExceptionHandler({
            AsyncRequestNotUsableException.class,
            ClientAbortException.class
    })
    public void disconnectedClient(
            Exception ex,
            HttpServletRequest request
    ) {
        log.debug(
                "Client connection closed correlationId={} path={}",
                MDC.get("correlationId"),
                request.getRequestURI()
        );
    }

    /**
     * Keep this as the final handler because it catches every other exception.
     */
    @ExceptionHandler(Exception.class)
    public ProblemDetail unexpected(
            Exception ex,
            HttpServletRequest request
    ) {
        log.error(
                "Unhandled request failure correlationId={} path={}",
                MDC.get("correlationId"),
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
                                + code.toLowerCase().replace('_', '-')
                )
        );

        problem.setTitle(status.getReasonPhrase());
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("errorCode", code);
        problem.setProperty("timestamp", Instant.now());
        problem.setProperty(
                "correlationId",
                MDC.get("correlationId")
        );

        if (fieldErrors != null) {
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
}