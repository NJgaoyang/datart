/*
 * Datart
 * <p>
 * Copyright 2021
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * <p>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package datart.core.common;

import datart.core.base.exception.Exceptions;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.lang3.StringUtils;

import java.io.*;
import java.nio.file.Paths;
import java.util.*;

@Slf4j
public class FileUtils {


    public static String concatPath(String... paths) {
        StringBuilder stringBuilder = new StringBuilder();
        for (int i = 0; i < paths.length; i++) {
            String path = paths[i];
            if (StringUtils.isBlank(path)) {
                continue;
            }
            path = StringUtils.appendIfMissing(path, "/");
            if (i != 0) {
                path = StringUtils.removeStart(path, "/");
            }
            if (i == paths.length - 1) {
                path = StringUtils.removeEnd(path, "/");
            }
            stringBuilder.append(path);
        }
        return StringUtils.removeEnd(stringBuilder.toString(), "/");
    }

    /**
     * Resolves and normalizes a path against the file base path.
     * Validates that the resolved canonical path does not escape the base directory
     * (directory traversal protection).
     *
     * @param path the relative or absolute path
     * @return the full, validated path string
     * @throws IllegalArgumentException if the path attempts to escape the base directory
     */
    public static String withBasePath(String path) {
        String fileBasePath = Application.getFileBasePath();
        if (path.startsWith(fileBasePath)) {
            path = path.substring(fileBasePath.length());
        }
        // Normalize the path to resolve "../" sequences before validation
        String normalizedPath = Paths.get(path).normalize().toString();
        // Reject empty or root-only paths that result from excessive traversal
        if (normalizedPath.isEmpty() || normalizedPath.equals(".") || normalizedPath.equals("..")) {
            throw new IllegalArgumentException("Invalid file path: path resolves outside base directory");
        }
        String fullPath = concatPath(fileBasePath, normalizedPath);
        try {
            File resolvedFile = new File(fullPath).getCanonicalFile();
            File baseDir = new File(fileBasePath).getCanonicalFile();
            if (!resolvedFile.getPath().startsWith(baseDir.getPath())) {
                throw new IllegalArgumentException("Path traversal detected: " + path);
            }
            return resolvedFile.getPath();
        } catch (IOException e) {
            throw new IllegalArgumentException("Unable to resolve file path: " + path, e);
        }
    }

    public static void mkdirParentIfNotExist(String path) {
        File file = new File(path);
        if (!file.getParentFile().exists()) {
            file.getParentFile().mkdirs();
        }
    }

    public static void delete(String path) {
        delete(resolveSafeFile(path));
    }

    public static void delete(File file) {
        if (file != null && file.exists()) {
            try {
                file.delete();
            } catch (Exception ignored) {
            }
        }
    }

    /**
     * Resolves a file path safely, ensuring it stays within the base directory.
     */
    private static File resolveSafeFile(String path) {
        try {
            File file = new File(path).getCanonicalFile();
            File baseDir = new File(Application.getFileBasePath()).getCanonicalFile();
            if (!file.getPath().startsWith(baseDir.getPath())) {
                throw new IllegalArgumentException("Path traversal detected: " + path);
            }
            return file;
        } catch (IOException e) {
            throw new IllegalArgumentException("Unable to resolve file path: " + path, e);
        }
    }

    public static Set<String> walkDir(File file, String extension, boolean recursion) {
        if (file == null || !file.exists()) {
            return Collections.emptySet();
        }
        if (file.isFile()) {
            return Collections.singleton(file.getName());
        } else {
            File[] files = file.listFiles(pathname -> extension == null || pathname.getName().endsWith(extension));
            if (files == null) {
                return Collections.emptySet();
            }
            Set<String> names = new LinkedHashSet<>();
            for (File f : files) {
                if (f.isFile()) {
                    names.add(f.getName());
                } else if (recursion) {
                    names.addAll(walkDir(f, extension, recursion));
                }
            }
            return names;
        }
    }

    public static Map<String, byte[]> walkDirAsStream(File baseDir, String extension, boolean recursion) {
        Map<String, byte[]> bytes = new HashMap<>();
        Set<String> files = walkDir(baseDir, extension, recursion);
        if (CollectionUtils.isEmpty(files)) {
            return Collections.emptyMap();
        }
        for (String name : files) {
            File file = new File(FileUtils.concatPath(baseDir.getAbsolutePath(), name));
            if (file.exists() && file.isFile()) {
                try {
                    FileInputStream inputStream = new FileInputStream(file);
                    byte[] buffer = new byte[inputStream.available()];
                    inputStream.read(buffer);
                    bytes.put(name, buffer);
                } catch (Exception e) {
                    log.error("Failed to read file: {}", name, e);
                }
            }
        }
        return bytes;
    }


    public static void save(String path, byte[] content, boolean cover) throws IOException {
        // Validate the path does not escape the base directory
        String basePath = Application.getFileBasePath();
        File targetFile;
        try {
            targetFile = new File(path).getCanonicalFile();
        } catch (IOException e) {
            throw new IOException("Unable to resolve file path: " + path, e);
        }
        File baseDir;
        try {
            baseDir = new File(basePath).getCanonicalFile();
        } catch (IOException e) {
            throw new IOException("Unable to resolve base path: " + basePath, e);
        }
        if (!targetFile.getPath().startsWith(baseDir.getPath() + File.separator)
                && !targetFile.getPath().equals(baseDir.getPath())) {
            throw new IllegalArgumentException("Path traversal detected in save: " + path);
        }
        if (!cover && targetFile.exists()) {
            Exceptions.msg("file already exists : " + path);
        }
        mkdirParentIfNotExist(targetFile.getPath());
        try (FileOutputStream outputStream = new FileOutputStream(targetFile)) {
            outputStream.write(content);
        }
    }

}
