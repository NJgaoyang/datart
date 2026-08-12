/**
 * Datart
 *
 * Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Authorized as AuthorizedComponent } from 'app/components';
import { ReactElement } from 'react';
import { useSelector } from 'react-redux';
import {
  PermissionLevels,
  ResourceTypes,
} from './pages/PermissionPage/constants';
import {
  selectIsOrgOwner,
  selectModuleAccessMap,
  selectPermissionMap,
} from './slice/selectors';
import { UserPermissionMap } from './slice/types';

export interface AccessProps {
  type?: 'module' | 'privilege';
  module: ResourceTypes;
  id?: string;
  level: PermissionLevels;
  denied?: ReactElement | null;
  children?: ReactElement | null;
}

export function Access({
  type = 'privilege',
  module,
  id,
  level,
  denied = null,
  children,
}: AccessProps) {
  const isOwner = useSelector(selectIsOrgOwner);
  const permissionMap = useSelector(selectPermissionMap);
  const moduleAccessMap = useSelector(selectModuleAccessMap);
  if (!permissionMap[module]) {
    return null;
  }

  const isAuthorized = calcAc(
    isOwner,
    permissionMap,
    moduleAccessMap,
    module,
    level,
    id,
    type,
  );

  return (
    <AuthorizedComponent authority={isAuthorized} denied={denied}>
      {children}
    </AuthorizedComponent>
  );
}

export interface AccessCascadeProps {
  module: ResourceTypes;
  path: string[];
  level: PermissionLevels;
  denied?: ReactElement | null;
  children?: ReactElement | null;
}

export function CascadeAccess({
  module,
  path,
  level,
  denied = null,
  children,
}: AccessCascadeProps) {
  const isOwner = useSelector(selectIsOrgOwner);
  const permissionMap = useSelector(selectPermissionMap);
  const moduleAccessMap = useSelector(selectModuleAccessMap);
  if (!permissionMap[module]) {
    return null;
  }
  const isAuthorized = getCascadeAccess(
    isOwner,
    permissionMap,
    moduleAccessMap,
    module,
    path,
    level,
  );

  return (
    <AuthorizedComponent authority={isAuthorized} denied={denied}>
      {children}
    </AuthorizedComponent>
  );
}

export function useAccess({
  type = 'privilege',
  module,
  id,
  level,
}: AccessProps) {
  const isOwner = useSelector(selectIsOrgOwner);
  const permissionMap = useSelector(selectPermissionMap);
  const moduleAccessMap = useSelector(selectModuleAccessMap);

  return function <T>(obj: T) {
    if (!permissionMap[module]) {
      return void 0;
    }

    const allow = calcAc(
      isOwner,
      permissionMap,
      moduleAccessMap,
      module,
      level,
      id,
      type,
    );
    return allow ? obj : void 0;
  };
}

export function useCascadeAccess({ module, path, level }: AccessCascadeProps) {
  const isOwner = useSelector(selectIsOrgOwner);
  const permissionMap = useSelector(selectPermissionMap);
  const moduleAccessMap = useSelector(selectModuleAccessMap);

  return function <T>(obj: T) {
    if (!permissionMap[module]) {
      return void 0;
    }

    const allow = getCascadeAccess(
      isOwner,
      permissionMap,
      moduleAccessMap,
      module,
      path,
      level,
    );
    return allow ? obj : void 0;
  };
}

export function getCascadeAccess(
  isOwner: boolean,
  permissionMap: UserPermissionMap,
  moduleAccessMap: Record<string, boolean>,
  module: ResourceTypes,
  path: string[],
  level: PermissionLevels,
) {
  // order: child -> parent
  const inversePath = path.slice().reverse();
  let allow = false;
  for (let i = 0; i < inversePath.length; i += 1) {
    const access = calcAc(
      isOwner,
      permissionMap,
      moduleAccessMap,
      module,
      level,
      inversePath[i],
    );
    if (access !== void 0) {
      allow = access;
      break;
    }
  }
  return allow;
}

export function calcAc(
  isOwner: boolean,
  permissionMap: UserPermissionMap,
  moduleAccessMap: Record<string, boolean>,
  module: ResourceTypes,
  level: PermissionLevels,
  id: string = '',
  type: 'module' | 'privilege' = 'privilege',
) {
  if (isOwner) return true;
  if (type === 'module') {
    // 模块级权限: '*' 权限为 Disable 或不存在时，模块不可见（即使有资源级权限）
    // '*' 被 Disable 时后端会删除该记录，所以 undefined 也视为 Disable
    if (
      permissionMap[module]['*'] === PermissionLevels.Disable ||
      permissionMap[module]['*'] === void 0
    )
      return false;
    if (permissionMap[module]['*'] >= level) return true;
    return !!moduleAccessMap[module];
  }
  if (!id) {
    // id 为空时，检查模块内是否有任意资源拥有该权限级别（排除 '*' 模块级权限）
    const modulePerms = permissionMap[module];
    if (!modulePerms) return false;
    return Object.keys(modulePerms).some(
      key =>
        key !== '*' &&
        modulePerms[key] !== void 0 &&
        (modulePerms[key] & level) === level,
    );
  }
  return permissionMap[module][id] !== void 0
    ? (permissionMap[module][id] & level) === level
    : void 0;
}
