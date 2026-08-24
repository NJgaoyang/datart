import {
  FolderAddFilled,
  FundProjectionScreenOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { ListSwitch } from 'app/components';
import useI18NPrefix, { I18NComponentProps } from 'app/hooks/useI18NPrefix';
import { Tooltip } from 'antd';
import classnames from 'classnames';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useMatch } from 'react-router-dom';
import styled from 'styled-components';
import { LEVEL_5, SPACE_LG } from 'styles/StyleConstants';
import { selectStoryboards, selectVizs } from '../slice/selectors';
import { Folder } from '../slice/types';
import { Folders } from './Folders';
import { Storyboards } from './Storyboards';

interface SidebarProps extends I18NComponentProps {
  isDragging: boolean;
  width: number;
  sliderVisible: boolean;
  handleSliderVisible: (status: boolean) => void;
}

export const Sidebar = memo(
  ({
    width,
    isDragging,
    i18nPrefix,
    sliderVisible,
    handleSliderVisible,
  }: SidebarProps) => {
    const [selectedKey, setSelectedKey] = useState('folder');
    const vizs = useSelector(selectVizs);
    const storyboards = useSelector(selectStoryboards);

    const matchDetail = useMatch(
      '/organizations/:orgId/vizs/:vizId/*',
    );
    const vizId = matchDetail?.params.vizId;
    const t = useI18NPrefix(i18nPrefix);
    const selectedFolderId = useMemo(() => {
      if (vizId && vizs) {
        const viz = vizs.find(({ relId }) => relId === vizId);
        return viz && viz.id;
      }
    }, [vizId, vizs]);

    useEffect(() => {
      if (vizId) {
        const viz =
          vizs.find(({ relId }) => relId === vizId) ||
          storyboards.find(({ id }) => id === vizId);
        if (viz) {
          setSelectedKey((viz as Folder).relType ? 'folder' : 'presentation');
        }
      }
    }, [vizId, storyboards, vizs]);

    const listTitles = useMemo(
      () => [
        { key: 'folder', icon: <FolderAddFilled />, text: t('folder') },
        {
          key: 'presentation',
          icon: <FundProjectionScreenOutlined />,
          text: t('presentation'),
        },
      ],
      [t],
    );

    const switchSelect = useCallback(key => {
      setSelectedKey(key);
    }, []);

    // 位置 1：展开状态下右侧的收起按钮
    const handleCollapse = useCallback(() => {
      handleSliderVisible(true);
    }, [handleSliderVisible]);

    // 位置 2：折叠状态下窄条上的打开按钮
    const handleExpand = useCallback(() => {
      handleSliderVisible(false);
    }, [handleSliderVisible]);

    return (
      <Wrapper
        sliderVisible={sliderVisible}
        className={sliderVisible ? 'close' : ''}
        isDragging={isDragging}
        width={width}
      >
        {/* 展开状态下的内容 */}
        <div className="sidebar-content">
          <div className="sidebar-toolbar">
            <ListSwitch
              titles={listTitles}
              selectedKey={selectedKey}
              onSelect={switchSelect}
            />
            <Tooltip title={t('folders.close')} placement="bottom">
              <span className="collapse-btn" onClick={handleCollapse}>
                <MenuFoldOutlined />
              </span>
            </Tooltip>
          </div>
          <Folders
            sliderVisible={sliderVisible}
            handleSliderVisible={handleSliderVisible}
            selectedId={selectedFolderId}
            i18nPrefix={i18nPrefix}
            className={classnames({ hidden: selectedKey !== 'folder' })}
          />
          <Storyboards
            sliderVisible={sliderVisible}
            handleSliderVisible={handleSliderVisible}
            selectedId={vizId}
            className={classnames({ hidden: selectedKey !== 'presentation' })}
            i18nPrefix={i18nPrefix}
          />
        </div>
        {/* 折叠状态下的窄条：位置 2 — 打开按钮 */}
        <Tooltip title={t('folders.open')} placement="right">
          <div className="sidebar-collapsed-bar" onClick={handleExpand}>
            <MenuUnfoldOutlined className="expand-icon" />
          </div>
        </Tooltip>
      </Wrapper>
    );
  },
);

const Wrapper = styled.div<{
  sliderVisible: boolean;
  isDragging: boolean;
  width: number;
}>`
  z-index: ${LEVEL_5};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  background-color: ${p => p.theme.componentBackground};
  box-shadow: ${p => p.theme.shadowSider};
  transition: ${p => (!p.isDragging ? 'width 0.3s ease' : 'none')};

  .hidden {
    display: none;
  }

  .sidebar-content {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .sidebar-toolbar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;

    .collapse-btn {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      color: ${p => p.theme.textColorLight};
      cursor: pointer;
      border-radius: 4px;

      &:hover {
        color: ${p => p.theme.textColor};
        background-color: ${p => p.theme.emphasisBackground};
      }
    }
  }

  .sidebar-collapsed-bar {
    display: none;
  }

  &.close {
    overflow: hidden;

    .sidebar-content {
      display: none;
    }

    .sidebar-collapsed-bar {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      height: 44px;
      margin-top: ${SPACE_LG};
      cursor: pointer;

      .expand-icon {
        font-size: 16px;
        color: ${p => p.theme.textColorLight};

        &:hover {
          color: ${p => p.theme.primary};
        }
      }
    }
  }
`;
