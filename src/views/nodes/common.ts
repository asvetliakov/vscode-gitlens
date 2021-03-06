import { Command, ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';
import { GlyphChars } from '../../constants';
import { Container } from '../../container';
import { View } from '../viewBase';
import { RefreshNodeCommandArgs } from '../viewCommands';
import { ResourceType, unknownGitUri, ViewNode } from './viewNode';

export class MessageNode extends ViewNode {
    constructor(
        parent: ViewNode,
        private readonly _message: string,
        private readonly _tooltip?: string,
        private readonly _iconPath?:
            | string
            | Uri
            | {
                  light: string | Uri;
                  dark: string | Uri;
              }
            | ThemeIcon
    ) {
        super(unknownGitUri, parent);
    }

    getChildren(): ViewNode[] | Promise<ViewNode[]> {
        return [];
    }

    getTreeItem(): TreeItem | Promise<TreeItem> {
        const item = new TreeItem(this._message, TreeItemCollapsibleState.None);
        item.contextValue = ResourceType.Message;
        item.tooltip = this._tooltip;
        item.iconPath = this._iconPath;
        return item;
    }
}

export class CommandMessageNode extends MessageNode {
    constructor(
        parent: ViewNode,
        private readonly _command: Command,
        message: string,
        tooltip?: string,
        iconPath?:
            | string
            | Uri
            | {
                  light: string | Uri;
                  dark: string | Uri;
              }
            | ThemeIcon
    ) {
        super(parent, message, tooltip, iconPath);
    }

    getTreeItem(): TreeItem | Promise<TreeItem> {
        const item = super.getTreeItem();
        if (item instanceof TreeItem) {
            item.command = this._command;
            return item;
        }

        return item.then(i => {
            i.command = this._command;
            return i;
        });
    }
}

export class UpdateableMessageNode extends ViewNode {
    constructor(
        parent: ViewNode,
        public readonly id: string,
        private _message: string,
        private _tooltip?: string,
        private _iconPath?:
            | string
            | Uri
            | {
                  light: string | Uri;
                  dark: string | Uri;
              }
            | ThemeIcon
    ) {
        super(unknownGitUri, parent);
    }

    getChildren(): ViewNode[] | Promise<ViewNode[]> {
        return [];
    }

    getTreeItem(): TreeItem | Promise<TreeItem> {
        const item = new TreeItem(this._message, TreeItemCollapsibleState.None);
        item.id = this.id;
        item.contextValue = ResourceType.Message;
        item.tooltip = this._tooltip;
        item.iconPath = this._iconPath;
        return item;
    }

    update(
        changes: {
            message?: string;
            tooltip?: string | null;
            iconPath?:
                | string
                | null
                | Uri
                | {
                      light: string | Uri;
                      dark: string | Uri;
                  }
                | ThemeIcon;
        },
        view: View
    ) {
        if (changes.message !== undefined) {
            this._message = changes.message;
        }

        if (changes.tooltip !== undefined) {
            this._tooltip = changes.tooltip === null ? undefined : changes.tooltip;
        }

        if (changes.iconPath !== undefined) {
            this._iconPath = changes.iconPath === null ? undefined : changes.iconPath;
        }

        view.triggerNodeUpdate(this);
    }
}

export abstract class PagerNode extends ViewNode {
    protected _args: RefreshNodeCommandArgs = {};

    constructor(
        protected readonly message: string,
        protected readonly parent: ViewNode,
        protected readonly view: View
    ) {
        super(unknownGitUri, parent);
    }

    getChildren(): ViewNode[] | Promise<ViewNode[]> {
        return [];
    }

    getTreeItem(): TreeItem | Promise<TreeItem> {
        const item = new TreeItem(this.message, TreeItemCollapsibleState.None);
        item.contextValue = ResourceType.Pager;
        item.command = this.getCommand();
        item.iconPath = {
            dark: Container.context.asAbsolutePath('images/dark/icon-unfold.svg'),
            light: Container.context.asAbsolutePath('images/light/icon-unfold.svg')
        };
        return item;
    }

    getCommand(): Command | undefined {
        return {
            title: 'Refresh',
            command: this.view.getQualifiedCommand('refreshNode'),
            arguments: [this.parent, this._args]
        } as Command;
    }
}

export class ShowMoreNode extends PagerNode {
    constructor(type: string, parent: ViewNode, view: View, maxCount: number = Container.config.advanced.maxListItems) {
        super(
            maxCount === 0
                ? `Show All ${type} ${GlyphChars.Space}${GlyphChars.Dash}${GlyphChars.Space} this may take a while`
                : `Show More ${type}`,
            parent,
            view
        );
        this._args.maxCount = maxCount;
    }
}
