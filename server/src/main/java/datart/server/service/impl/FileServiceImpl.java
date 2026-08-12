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
package datart.server.service.impl;

import datart.core.base.consts.Const;
import datart.core.base.consts.FileOwner;
import datart.core.base.exception.Exceptions;
import datart.core.common.Application;
import datart.core.common.FileUtils;
import datart.core.entity.*;
import datart.server.service.BaseService;
import datart.server.service.FileService;
import datart.server.service.OrgService;
import datart.server.service.UserService;
import datart.server.service.DashboardService;
import datart.server.service.DatachartService;
import datart.server.service.SourceService;
import net.coobird.thumbnailator.Thumbnails;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.util.FileSystemUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.awt.image.BufferedImage;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import javax.imageio.ImageIO;

@Service
public class FileServiceImpl extends BaseService implements FileService {

    private static final long MAX_IMAGE_SIZE = 10L * 1024 * 1024;

    private static final long MAX_DATA_SOURCE_SIZE = 100L * 1024 * 1024;

    private static final long MAX_IMAGE_PIXELS = 40_000_000L;

    private static final Set<String> IMAGE_EXTENSIONS = new HashSet<>(Arrays.asList("png", "jpg", "jpeg", "gif"));

    private static final Set<String> DATA_SOURCE_EXTENSIONS = new HashSet<>(Arrays.asList("csv", "xls", "xlsx"));

    @Override
    public String uploadFile(FileOwner fileOwner, String ownerId, MultipartFile file, String fileName) throws IOException {
        switch (fileOwner) {
            case DASHBOARD:
            case DATACHART:
                return saveVizImage(fileOwner, ownerId, file, fileName);
            case USER_AVATAR:
                return updateUserAvatar(ownerId, file);
            case ORG_AVATAR:
                return updateOrgAvatar(ownerId, file);
            case DATA_SOURCE:
                return saveAsDatasource(fileOwner, ownerId, file);
            default:
                Exceptions.msg("unknown file type " + fileOwner);
        }
        return null;
    }


    @Override
    public boolean deleteFiles(FileOwner fileOwner, String ownerId) {
        try {
            switch (fileOwner) {
                case ORG_AVATAR:
                    securityManager.requireOrgOwner(ownerId);
                    OrgService orgService = Application.getBean(OrgService.class);
                    orgService.updateAvatar(ownerId, "");
                    break;
                case USER_AVATAR:
                    requireExists(ownerId, User.class);
                    if (!ownerId.equals(getCurrentUser().getId())) {
                        Exceptions.msg("Cannot delete another user's avatar");
                    }
                    UserService userService = Application.getBean(UserService.class);
                    userService.updateAvatar("");
                    break;
                default:
                    break;
            }
            String path = FileUtils.concatPath(Application.getFileBasePath(), fileOwner.getPath(), ownerId);
            return FileSystemUtils.deleteRecursively(new File(path));
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public String getBasePath(FileOwner owner, String id) {
        return FileUtils.concatPath(Application.getFileBasePath(), owner.getPath(), id);
    }

    private String saveVizImage(FileOwner fileOwner, String ownerId, MultipartFile file, String fileName) throws IOException {
        switch (fileOwner) {
            case DASHBOARD:
                DashboardService dashboardService = Application.getBean(DashboardService.class);
                Dashboard dashboard = dashboardService.retrieve(ownerId);
                dashboardService.requirePermission(dashboard, Const.MANAGE);
                break;
            case DATACHART:
                DatachartService datachartService = Application.getBean(DatachartService.class);
                Datachart datachart = datachartService.retrieve(ownerId);
                datachartService.requirePermission(datachart, Const.MANAGE);
                break;
        }
        validateImage(file);
        String safeFileName = sanitizeFileName(StringUtils.isBlank(fileName) ? file.getOriginalFilename() : fileName);
        String filePath = FileUtils.concatPath(fileOwner.getPath(), ownerId, safeFileName);
        String fullPath = FileUtils.withBasePath(filePath);
        FileUtils.mkdirParentIfNotExist(fullPath);
        file.transferTo(new File(fullPath));
        return filePath;
    }

    private String updateUserAvatar(String userId, MultipartFile file) throws IOException {

        requireExists(userId, User.class);
        if (!userId.equals(getCurrentUser().getId())) {
            Exceptions.msg("Cannot update another user's avatar");
        }
        validateImage(file);

        String filePath = FileUtils.concatPath(FileOwner.USER_AVATAR.getPath(), userId, sanitizeFileName(file.getOriginalFilename()));

        String fullPath = FileUtils.withBasePath(filePath);

        FileUtils.mkdirParentIfNotExist(fullPath);

        Thumbnails.of(file.getInputStream())
                .size(Const.IMAGE_WIDTH, Const.IMAGE_HEIGHT)
                .toFile(fullPath);

        UserService userService = Application.getBean(UserService.class);

        userService.updateAvatar(filePath);

        return filePath;
    }

    private String updateOrgAvatar(String orgId, MultipartFile file) throws IOException {

        requireExists(orgId, Organization.class);
        securityManager.requireOrgOwner(orgId);
        validateImage(file);

        String filePath = FileUtils.concatPath(FileOwner.ORG_AVATAR.getPath(), orgId, sanitizeFileName(file.getOriginalFilename()));

        String fullPath = FileUtils.withBasePath(filePath);


        FileUtils.mkdirParentIfNotExist(fullPath);

        Thumbnails.of(file.getInputStream())
                .size(Const.IMAGE_WIDTH, Const.IMAGE_HEIGHT)
                .toFile(fullPath);

        OrgService orgService = Application.getBean(OrgService.class);

        orgService.updateAvatar(orgId, filePath);

        return filePath;
    }

    public String saveAsDatasource(FileOwner fileOwner, String ownerId, MultipartFile file) throws IOException {

        SourceService sourceService = Application.getBean(SourceService.class);
        Source source = sourceService.retrieve(ownerId);
        sourceService.requirePermission(source, Const.MANAGE);
        validateFile(file, MAX_DATA_SOURCE_SIZE, DATA_SOURCE_EXTENSIONS);

        String filePath = FileUtils.concatPath(fileOwner.getPath(), ownerId, System.currentTimeMillis() + "-" + sanitizeFileName(file.getOriginalFilename()));

        String fullPath = FileUtils.withBasePath(filePath);

        FileUtils.mkdirParentIfNotExist(fullPath);

        file.transferTo(new File(fullPath));

        return filePath;
    }

    private void validateImage(MultipartFile file) throws IOException {
        validateFile(file, MAX_IMAGE_SIZE, IMAGE_EXTENSIONS);
        BufferedImage image = ImageIO.read(file.getInputStream());
        if (image == null || (long) image.getWidth() * image.getHeight() > MAX_IMAGE_PIXELS) {
            throw new IllegalArgumentException("Invalid or oversized image");
        }
    }

    private void validateFile(MultipartFile file, long maxSize, Set<String> extensions) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }
        if (file.getSize() > maxSize) {
            throw new IllegalArgumentException("Uploaded file exceeds the allowed size");
        }
        String fileName = sanitizeFileName(file.getOriginalFilename());
        String extension = StringUtils.substringAfterLast(fileName, ".").toLowerCase();
        if (!extensions.contains(extension)) {
            throw new IllegalArgumentException("Unsupported file type");
        }
    }

    private String sanitizeFileName(String fileName) {
        if (StringUtils.isBlank(fileName)) {
            throw new IllegalArgumentException("File name is required");
        }
        String safeFileName = Paths.get(fileName).getFileName().toString();
        if (!safeFileName.equals(fileName) || safeFileName.contains("..")) {
            throw new IllegalArgumentException("Invalid file name");
        }
        return safeFileName;
    }

}
