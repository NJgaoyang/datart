package datart.server.common;

import java.io.IOException;
import java.io.InputStream;
import java.io.InvalidClassException;
import java.io.ObjectInputStream;
import java.io.ObjectStreamClass;
import java.lang.reflect.Proxy;
import java.util.Arrays;
import java.util.List;

public class SecureObjectInputStream extends ObjectInputStream {

    private static final List<String> ALLOWED_PREFIXES = Arrays.asList(
            "datart.server.base.transfer.model.",
            "datart.server.base.dto.WidgetDetail",
            "datart.core.entity.",
            "datart.core.base.consts.",
            "java.lang.",
            "java.util."
    );

    /**
     * 危险类/包黑名单：优先级高于白名单。即使某些类落在 java.lang./java.util. 等允许前缀下，
     * 只要命中黑名单即拒绝反序列化，用于封堵常见的反序列化 gadget 载体与触发点。
     */
    private static final List<String> DENIED_CLASSES = Arrays.asList(
            // JDK 进程 / 反射 / 类加载 / 线程相关 gadget
            "java.lang.ProcessBuilder",
            "java.lang.Process",
            "java.lang.Runtime",
            "java.lang.ClassLoader",
            "java.lang.Thread",
            "java.lang.reflect.",
            "java.lang.invoke.",
            // JDK 集合类 gadget 载体（需配合 Comparator/Comparable 触发）
            "java.util.PriorityQueue",
            "java.util.TreeMap",
            "java.util.TreeSet",
            // 常见 JDK / 第三方 gadget 包
            "java.beans.",
            "java.net.",
            "java.rmi.",
            "java.io.File",
            "javax.management.",
            "javax.naming.",
            "javax.script.",
            "org.apache.commons.collections.functors.",
            "org.apache.commons.collections4.functors.",
            "org.apache.commons.beanutils.",
            "org.codehaus.groovy.runtime.",
            "org.mozilla.javascript.",
            "com.sun.",
            "sun."
    );

    public SecureObjectInputStream(InputStream inputStream) throws IOException {
        super(inputStream);
    }

    @Override
    protected Class<?> resolveClass(ObjectStreamClass descriptor) throws IOException, ClassNotFoundException {
        String className = descriptor.getName();
        if (!isAllowed(className)) {
            throw new InvalidClassException("Unauthorized deserialization type", className);
        }
        return super.resolveClass(descriptor);
    }

    @Override
    protected Class<?> resolveProxyClass(String[] interfaces) throws IOException {
        throw new InvalidClassException("Proxy deserialization is not allowed");
    }

    private boolean isAllowed(String className) {
        while (className.startsWith("[")) {
            className = className.substring(1);
        }
        if (className.length() == 1) {
            return true;
        }
        if (className.startsWith("L") && className.endsWith(";")) {
            className = className.substring(1, className.length() - 1);
        }
        // 黑名单优先：命中即拒绝，即使其落在允许前缀下
        for (String denied : DENIED_CLASSES) {
            if (className.startsWith(denied)) {
                return false;
            }
        }
        for (String prefix : ALLOWED_PREFIXES) {
            if (className.startsWith(prefix)) {
                return !Proxy.class.getName().equals(className);
            }
        }
        return false;
    }
}
