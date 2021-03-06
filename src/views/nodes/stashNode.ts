'use strict';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { Container } from '../../container';
import { CommitFormatter, GitStashCommit, ICommitFormatOptions } from '../../git/gitService';
import { Iterables } from '../../system';
import { View } from '../viewBase';
import { StashFileNode } from './stashFileNode';
import { ResourceType, ViewNode, ViewRefNode } from './viewNode';

export class StashNode extends ViewRefNode {
    constructor(
        public readonly commit: GitStashCommit,
        parent: ViewNode,
        public readonly view: View
    ) {
        super(commit.toGitUri(), parent);
    }

    get id(): string {
        return `gitlens:repository(${this.commit.repoPath}):stash(${this.commit.sha})`;
    }

    get ref(): string {
        return this.commit.sha;
    }

    async getChildren(): Promise<ViewNode[]> {
        const files = (this.commit as GitStashCommit).files;

        // Check for any untracked files -- since git doesn't return them via `git stash list` :(
        const log = await Container.git.getLog(this.commit.repoPath, {
            maxCount: 1,
            ref: `${(this.commit as GitStashCommit).stashName}^3`
        });
        if (log !== undefined) {
            const commit = Iterables.first(log.commits.values());
            if (commit !== undefined && commit.files.length !== 0) {
                // Since these files are untracked -- make them look that way
                commit.files.forEach(s => (s.status = '?'));
                files.splice(files.length, 0, ...commit.files);
            }
        }

        const children = files.map(s => new StashFileNode(s, this.commit.toFileCommit(s), this, this.view));
        children.sort((a, b) => a.label!.localeCompare(b.label!));
        return children;
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem(
            CommitFormatter.fromTemplate(this.view.config.stashFormat, this.commit, {
                truncateMessageAtNewLine: true,
                dateFormat: Container.config.defaultDateFormat
            } as ICommitFormatOptions),
            TreeItemCollapsibleState.Collapsed
        );
        item.id = this.id;
        item.contextValue = ResourceType.Stash;
        item.tooltip = CommitFormatter.fromTemplate('${ago} (${date})\n\n${message}', this.commit, {
            dateFormat: Container.config.defaultDateFormat
        } as ICommitFormatOptions);

        return item;
    }
}
