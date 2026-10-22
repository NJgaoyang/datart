import { cloneElement, ReactElement, ReactNode } from 'react';
import styled from 'styled-components';
import { SPACE, SPACE_XS } from 'styles/StyleConstants';
import { mergeClassNames } from 'utils/utils';

interface ListItemProps {
  prefix?: ReactElement;
  suffix?: ReactElement;
  children?: ReactNode;
}

export function MenuItemLabel({ prefix, suffix, children }: ListItemProps) {
  return (
    <StyledListItem>
      {prefix &&
        cloneElement(prefix as ReactElement<{ className?: string }>, {
          className: mergeClassNames(
            (prefix.props as { className?: string }).className,
            'prefix',
          ),
        })}
      {children}
      {suffix &&
        cloneElement(suffix as ReactElement<{ className?: string }>, {
          className: mergeClassNames(
            (suffix.props as { className?: string }).className,
            'suffix',
          ),
        })}
    </StyledListItem>
  );
}

const StyledListItem = styled.div`
  display: flex;
  align-items: center;

  > .prefix {
    flex-shrink: 0;
    margin-right: ${SPACE_XS};
  }

  > .suffix {
    flex-shrink: 0;
    padding: 0 ${SPACE};
  }

  > .prefix,
  > .suffix {
    &.icon {
      color: ${p => p.theme.textColorLight};
    }
  }

  > p {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
