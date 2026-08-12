package datart.server.config;

import datart.core.entity.BaseEntity;
import datart.core.log.AccessType;
import datart.security.base.ResourceType;
import datart.server.service.AsyncAccessLogService;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.*;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;

@Aspect
@Component
public class AccessLogAdvice {

    private final AsyncAccessLogService logService;

    private final ResourceNameResolver nameResolver;

    public AccessLogAdvice(AsyncAccessLogService logService, ResourceNameResolver nameResolver) {
        this.logService = logService;
        this.nameResolver = nameResolver;
    }

    @Before(value = "execution(* datart.core.mappers..*.selectByPrimaryKey(java.lang.String)) && args(id)")
    public void selectByPrimaryKey(JoinPoint jp, String id) {
        MethodSignature signature = (MethodSignature) jp.getSignature();
        ResourceType resourceType = getResourceType(signature.getReturnType());
        String resourceName = nameResolver.resolveName(resourceType, id);
        log(AccessType.READ, resourceType, id, resourceName);
    }

    @Before(value = "execution(* datart.core.mappers..*.deleteByPrimaryKey(java.lang.String)) && args(id)")
    public void deleteByPrimaryKey(JoinPoint jp, String id) {
        MethodSignature signature = (MethodSignature) jp.getSignature();
        ResourceType resourceType = getResourceType(getReturnType(signature.getDeclaringTypeName()));
        String resourceName = nameResolver.resolveName(resourceType, id);
        log(AccessType.DELETE, resourceType, id, resourceName);
    }

    @Before(value = "execution(* datart.core.mappers..*.insert(datart.core.entity.BaseEntity)) && args(entity)")
    public void insert(JoinPoint jp, BaseEntity entity) {
        ResourceType resourceType = getResourceType(entity.getClass());
        String resourceName = getEntityName(entity);
        log(AccessType.CREATE, resourceType, entity.getId(), resourceName);
    }

    @Before(value = "execution(* datart.core.mappers..*.updateByPrimaryKey*(datart.core.entity.BaseEntity)) && args(entity)")
    public void updateByPrimaryKey(JoinPoint jp, BaseEntity entity) {
        ResourceType resourceType = getResourceType(entity.getClass());
        String resourceName = getEntityName(entity);
        log(AccessType.UPDATE, resourceType, entity.getId(), resourceName);
    }

    private void log(AccessType accessType, ResourceType resourceType, String id, String resourceName) {
        try {
            logService.log(accessType, resourceType, id, resourceName);
        } catch (Exception ignored) {
        }
    }

    private ResourceType getResourceType(Class<?> clz) {
        try {
            if (clz == null) return null;
            return ResourceType.valueOf(clz.getSimpleName().toUpperCase());
        } catch (Exception e) {
            return null;
        }
    }

    private Class<?> getReturnType(String mapperClassName) {
        try {
            String simpleName = mapperClassName.substring(mapperClassName.lastIndexOf('.') + 1)
                    .replace("MapperExt", "").replace("Mapper", "");
            return Class.forName("datart.core.entity." + simpleName);
        } catch (Exception e) {
            return null;
        }
    }

    private String getEntityName(BaseEntity entity) {
        try {
            Method getNameMethod = entity.getClass().getMethod("getName");
            return (String) getNameMethod.invoke(entity);
        } catch (Exception e) {
            return null;
        }
    }

}
