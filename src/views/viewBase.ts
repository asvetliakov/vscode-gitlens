'use strict';
import {
    ConfigurationChangeEvent,
    Disposable,
    Event,
    EventEmitter,
    TreeDataProvider,
    TreeItem,
    TreeView,
    TreeViewVisibilityChangeEvent,
    window
} from 'vscode';
import { configuration } from '../configuration';
import { Container } from '../container';
import { Logger } from '../logger';
import { FileHistoryView } from './fileHistoryView';
import { LineHistoryView } from './lineHistoryView';
import { ViewNode } from './nodes';
import { isPageable } from './nodes/viewNode';
import { RepositoriesView } from './repositoriesView';
import { ResultsView } from './resultsView';
import { RefreshNodeCommandArgs } from './viewCommands';

export enum RefreshReason {
    Command = 'Command',
    ConfigurationChanged = 'ConfigurationChanged',
    VisibilityChanged = 'VisibilityChanged'
}

export type View = RepositoriesView | FileHistoryView | LineHistoryView | ResultsView;

export abstract class ViewBase<TRoot extends ViewNode> implements TreeDataProvider<ViewNode>, Disposable {
    protected _onDidChangeTreeData = new EventEmitter<ViewNode>();
    public get onDidChangeTreeData(): Event<ViewNode> {
        return this._onDidChangeTreeData.event;
    }

    private _onDidChangeVisibility = new EventEmitter<TreeViewVisibilityChangeEvent>();
    public get onDidChangeVisibility(): Event<TreeViewVisibilityChangeEvent> {
        return this._onDidChangeVisibility.event;
    }

    protected _disposable: Disposable | undefined;
    protected _root: TRoot | undefined;
    protected _tree: TreeView<ViewNode> | undefined;

    constructor(
        public readonly id: string
    ) {
        this.registerCommands();

        Container.context.subscriptions.push(configuration.onDidChange(this.onConfigurationChanged, this));
        setImmediate(() => this.onConfigurationChanged(configuration.initializingChangeEvent));
    }

    dispose() {
        this._disposable && this._disposable.dispose();
    }

    getQualifiedCommand(command: string) {
        return `${this.id}.${command}`;
    }

    protected abstract getRoot(): TRoot;
    protected abstract registerCommands(): void;
    protected abstract onConfigurationChanged(e: ConfigurationChangeEvent): void;

    protected initialize(container?: string) {
        if (this._disposable) {
            this._disposable.dispose();
            this._onDidChangeTreeData = new EventEmitter<ViewNode>();
        }

        this._tree = window.createTreeView(`${this.id}${container ? `:${container}` : ''}`, {
            treeDataProvider: this
        });
        this._disposable = Disposable.from(
            this._tree,
            this._tree.onDidChangeVisibility(this.onVisibilityChanged, this)
        );
    }

    getChildren(node?: ViewNode): ViewNode[] | Promise<ViewNode[]> {
        if (node !== undefined) return node.getChildren();

        if (this._root === undefined) {
            this._root = this.getRoot();
        }

        return this._root.getChildren();
    }

    getParent(node: ViewNode): ViewNode | undefined {
        return node.getParent();
    }

    getTreeItem(node: ViewNode): TreeItem | Promise<TreeItem> {
        return node.getTreeItem();
    }

    protected onVisibilityChanged(e: TreeViewVisibilityChangeEvent) {
        this._onDidChangeVisibility.fire(e);
    }

    get selection(): ViewNode[] {
        if (this._tree === undefined || this._root === undefined) return [];

        return this._tree.selection;
    }

    get visible(): boolean {
        return this._tree !== undefined ? this._tree.visible : false;
    }

    async refresh(reason?: RefreshReason) {
        if (reason === undefined) {
            reason = RefreshReason.Command;
        }

        Logger.log(`View(${this.id}).refresh`, `reason='${reason}'`);

        if (this._root !== undefined) {
            await this._root.refresh(reason);
        }

        this.triggerNodeUpdate();
    }

    async refreshNode(node: ViewNode, args?: RefreshNodeCommandArgs) {
        Logger.log(`View(${this.id}).refreshNode(${(node as { id?: string }).id || ''})`);

        if (args !== undefined) {
            if (isPageable(node)) {
                if (args.maxCount === undefined || args.maxCount === 0) {
                    node.maxCount = args.maxCount;
                }
                else {
                    node.maxCount = (node.maxCount || args.maxCount) + args.maxCount;
                }
            }
        }

        const cancel = await node.refresh();
        if (cancel === true) return;

        this.triggerNodeUpdate(node);
    }

    async reveal(
        node: ViewNode,
        options?: {
            select?: boolean | undefined;
            focus?: boolean | undefined;
        }
    ) {
        if (this._tree === undefined || this._root === undefined) return;

        try {
            await this._tree.reveal(node, options);
        }
        catch (ex) {
            Logger.error(ex);
        }
    }

    async show() {
        if (this._tree === undefined || this._root === undefined) return;

        // This sucks -- have to get the first child to reveal the tree
        const [child] = await this._root.getChildren();
        return this.reveal(child, { select: false, focus: true });
    }

    triggerNodeUpdate(node?: ViewNode) {
        // Since the root node won't actually refresh, force everything
        this._onDidChangeTreeData.fire(node !== undefined && node !== this._root ? node : undefined);
    }
}
