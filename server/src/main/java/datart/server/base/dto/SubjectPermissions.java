package datart.server.base.dto;

import datart.security.base.PermissionInfo;
import datart.security.base.SubjectType;
import lombok.Data;

import java.util.List;
import java.util.Set;

@Data
public class SubjectPermissions {

    private String orgId;

    private String subjectId;

    private SubjectType subjectType;

    private boolean orgOwner;

    private List<PermissionInfo> permissionInfos;

    /**
     * 当用户无某模块的任何权限时，隐藏的导航模块列表。
     * 数据级联依赖 (SOURCE → VIEW → VIZ) 在数据执行层强制检查。
     */
    private Set<String> hideInNav;

}
