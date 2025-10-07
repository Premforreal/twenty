import { TabMoreButton } from '@/ui/layout/tab-list/components/TabMoreButton';
import { TAB_LIST_GAP } from '@/ui/layout/tab-list/constants/TabListGap';
import { useTabListContextOrThrow } from '@/ui/layout/tab-list/contexts/TabListContext';
import { NodeDimension } from '@/ui/utilities/dimensions/components/NodeDimension';
import styled from '@emotion/styled';
import { IconPlus } from 'twenty-ui/display';
import { IconButton, TabButton } from 'twenty-ui/input';

const StyledHiddenMeasurement = styled.div`
  display: flex;
  gap: ${TAB_LIST_GAP}px;
  pointer-events: none;
  position: absolute;
  top: -9999px;
  visibility: hidden;
`;

const StyledAddButton = styled.div`
  display: flex;
  align-items: center;
  height: ${({ theme }) => theme.spacing(10)};
  margin-left: ${TAB_LIST_GAP}px;
`;

export const TabListMeasurements = () => {
  const {
    visibleTabs,
    activeTabId,
    loading,
    onAddTab,
    onTabWidthChange,
    onMoreButtonWidthChange,
    onAddButtonWidthChange,
  } = useTabListContextOrThrow();

  if (visibleTabs.length <= 1) {
    return null;
  }

  return (
    <StyledHiddenMeasurement>
      {visibleTabs.map((tab) => (
        <NodeDimension
          key={tab.id}
          id={tab.id}
          onDimensionChange={onTabWidthChange}
        >
          <TabButton
            id={tab.id}
            title={tab.title}
            LeftIcon={tab.Icon}
            logo={tab.logo}
            active={tab.id === activeTabId}
            disabled={tab.disabled ?? loading}
            pill={tab.pill}
            disableTestId={true}
          />
        </NodeDimension>
      ))}

      <NodeDimension onDimensionChange={onMoreButtonWidthChange}>
        <TabMoreButton overflowCount={1} active={false} />
      </NodeDimension>

      {onAddTab && (
        <NodeDimension onDimensionChange={onAddButtonWidthChange}>
          <StyledAddButton>
            <IconButton Icon={IconPlus} size="small" variant="tertiary" />
          </StyledAddButton>
        </NodeDimension>
      )}
    </StyledHiddenMeasurement>
  );
};
