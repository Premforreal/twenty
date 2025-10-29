import { type MessageFolder } from '@/accounts/types/MessageFolder';
import { SettingsAccountsMessageFolderIcon } from '@/settings/accounts/components/message-folders/SettingsAccountsMessageFolderIcon';
import { formatFolderName } from '@/settings/accounts/components/message-folders/utils/formatFolderName.util';

import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableRow } from '@/ui/layout/table/components/TableRow';
import styled from '@emotion/styled';
import { IconChevronDown, IconChevronUp } from 'twenty-ui/display';
import { Checkbox, CheckboxSize, IconButton } from 'twenty-ui/input';

const StyledFolderNameWrapper = styled.div`
  align-items: center;
  display: flex;
  flex: 1;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledTableRow = styled(TableRow)``;

const StyledCheckboxCell = styled(TableCell)`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  justify-content: flex-end;
`;

const StyledIndentContainer = styled.div<{ depth: number }>`
  display: flex;
  align-items: center;
  padding-left: ${({ depth, theme }) => theme.spacing(depth * 3)};
`;

const StyledBreadcrumbContainer = styled.div`
  flex-shrink: 0;
  height: 28px;
  margin-left: 7.5px;
  margin-right: ${({ theme }) => theme.spacing(2)};
  width: 9px;
`;

const StyledGapVerticalLine = styled.div`
  background: ${({ theme }) => theme.border.color.strong};
  position: relative;
  top: -2px;
  height: 2px;
  width: 1px;
`;

const StyledSecondaryFullVerticalBar = styled.div`
  background: ${({ theme }) => theme.border.color.strong};
  position: relative;
  top: -17px;
  height: 28px;
  width: 1px;
`;

const StyledRoundedProtrusion = styled.div`
  position: relative;
  top: -2px;
  border-bottom-left-radius: 4px;
  border: 1px solid ${({ theme }) => theme.border.color.strong};
  border-top: none;
  border-right: none;
  height: 14px;
  width: 8px;
`;

const StyledChildCount = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledExpandButton = styled.div`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  height: 24px;
  justify-content: center;
  margin-right: ${({ theme }) => theme.spacing(1)};
  width: 24px;
`;

type SettingsMessageFoldersTableRowProps = {
  folder: MessageFolder;
  onSyncToggle: () => void;
  depth?: number;
  isLast?: boolean;
  hasChildren?: boolean;
  childCount?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
};

export const SettingsMessageFoldersTableRow = ({
  folder,
  onSyncToggle,
  depth = 0,
  isLast = false,
  hasChildren = false,
  childCount = 0,
  isExpanded = false,
  onToggleExpand,
}: SettingsMessageFoldersTableRowProps) => {
  const showVerticalBar = !isLast;

  return (
    <StyledTableRow gridAutoColumns="1fr 120px">
      <TableCell>
        <StyledIndentContainer depth={depth}>
          {depth > 0 && (
            <StyledBreadcrumbContainer>
              <StyledGapVerticalLine />
              <StyledRoundedProtrusion />
              {showVerticalBar && <StyledSecondaryFullVerticalBar />}
            </StyledBreadcrumbContainer>
          )}
          <StyledExpandButton>
            {hasChildren && onToggleExpand && (
              <IconButton
                Icon={isExpanded ? IconChevronUp : IconChevronDown}
                onClick={onToggleExpand}
                size="small"
                variant="tertiary"
              />
            )}
          </StyledExpandButton>
          <StyledFolderNameWrapper>
            <SettingsAccountsMessageFolderIcon folder={folder} />
            {formatFolderName(folder.name)}
          </StyledFolderNameWrapper>
        </StyledIndentContainer>
      </TableCell>
      <StyledCheckboxCell>
        {hasChildren && childCount > 0 && (
          <StyledChildCount>{childCount}</StyledChildCount>
        )}
        <Checkbox
          checked={folder.isSynced}
          onChange={onSyncToggle}
          size={CheckboxSize.Small}
        />
      </StyledCheckboxCell>
    </StyledTableRow>
  );
};
