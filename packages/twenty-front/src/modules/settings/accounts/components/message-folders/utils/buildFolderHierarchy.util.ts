import { type MessageFolder } from '@/accounts/types/MessageFolder';
import { isDefined } from 'twenty-shared/utils';

export type FolderHierarchyNode = {
  folder: MessageFolder;
  children: FolderHierarchyNode[];
  depth: number;
  isExpanded: boolean;
  childCount: number;
};

export type FlattenedFolder = {
  folder: MessageFolder;
  depth: number;
  isLast: boolean;
  hasChildren: boolean;
  childCount: number;
  isExpanded: boolean;
  parentPath: string[];
};

export const buildFolderHierarchy = (
  folders: MessageFolder[],
): FolderHierarchyNode[] => {
  const folderMap = new Map<string, FolderHierarchyNode>();
  const folderByExternalId = new Map<string, MessageFolder>();
  const rootFolders: FolderHierarchyNode[] = [];

  folders.forEach((folder) => {
    folderMap.set(folder.id, {
      folder,
      children: [],
      depth: 0,
      isExpanded: true,
      childCount: 0,
    });
    if (isDefined(folder.externalId)) {
      folderByExternalId.set(folder.externalId, folder);
    }
  });

  folders.forEach((folder) => {
    const node = folderMap.get(folder.id)!;

    if (isDefined(folder.parentFolderId)) {
      let parentNode = folderMap.get(folder.parentFolderId);

      if (!parentNode) {
        const parentFolder = folderByExternalId.get(folder.parentFolderId);
        if (isDefined(parentFolder)) {
          parentNode = folderMap.get(parentFolder.id);
        }
      }

      if (isDefined(parentNode)) {
        parentNode.children.push(node);
        node.depth = parentNode.depth + 1;
      } else {
        rootFolders.push(node);
      }
    } else {
      rootFolders.push(node);
    }
  });

  const sortChildren = (nodes: FolderHierarchyNode[]) => {
    nodes.sort((a, b) => a.folder.name.localeCompare(b.folder.name));
    nodes.forEach((node) => {
      if (node.children.length > 0) {
        sortChildren(node.children);
      }
    });
  };

  sortChildren(rootFolders);

  const calculateChildCount = (node: FolderHierarchyNode): number => {
    if (node.children.length === 0) {
      return 0;
    }
    const directChildren = node.children.length;
    const nestedChildren = node.children.reduce(
      (sum, child) => sum + calculateChildCount(child),
      0,
    );
    node.childCount = directChildren + nestedChildren;
    return node.childCount;
  };

  rootFolders.forEach(calculateChildCount);

  return rootFolders;
};

export const flattenFolderHierarchy = (
  hierarchy: FolderHierarchyNode[],
  expandedFolderIds: Set<string>,
): FlattenedFolder[] => {
  const flattened: FlattenedFolder[] = [];

  const traverse = (
    nodes: FolderHierarchyNode[],
    parentPath: string[] = [],
  ) => {
    nodes.forEach((node, index) => {
      const isLast = index === nodes.length - 1;
      const isExpanded = expandedFolderIds.has(node.folder.id);
      const hasChildren = node.children.length > 0;

      flattened.push({
        folder: node.folder,
        depth: node.depth,
        isLast,
        hasChildren,
        childCount: node.childCount,
        isExpanded,
        parentPath: [...parentPath],
      });

      if (hasChildren && isExpanded) {
        traverse(node.children, [...parentPath, node.folder.id]);
      }
    });
  };

  traverse(hierarchy);

  return flattened;
};
