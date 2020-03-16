import { Filesystem, FSEntry, getPathEntry, NotImplementedError } from '.';
import React from 'react';

import QFrameAPI from '../../../lib/api';

import utils from '../utils';
import { RawCommitData, parseCommits, CommitData } from '../parse_commits';
import { TreeLink, TreeLinkKey } from '../../MainApp';
import * as THREE from 'three';
import TourSelector from '../../TourSelector';
import Player from '../../Player';
import CommitControls from '../../CommitControls';
import CommitInfo from '../../CommitInfo';
import { getFullPath } from './filesystem';

export default class MontaanGitFilesystem extends Filesystem {
	repo: string;
	ref: string;
	commitData?: CommitData;
	dependencies?: TreeLink[];
	dependencySrcIndex?: Map<TreeLinkKey, TreeLink[]>;
	dependencyDstIndex?: Map<TreeLinkKey, TreeLink[]>;

	constructor(url: string, api: QFrameAPI, mountPoint: FSEntry) {
		super(url, api, mountPoint);
		const urlSegments = this.url.pathname.replace(/^\/+/, '').split('/');
		this.repo = urlSegments.slice(0, -1).join('/');
		this.ref = urlSegments[urlSegments.length - 1];
	}

	getUIComponents(state: any): React.ReactElement {
		const path = getFullPath(this.mountPoint);
		const repoPrefix = this.repo;
		return (
			<>
				<TourSelector
					path={path}
					repoPrefix={repoPrefix}
					fileTree={this.mountPoint}
					api={this.api}
				/>
				<Player
					repoPrefix={repoPrefix}
					fileTree={state.fileTree}
					navigationTarget={state.navigationTarget}
					api={this.api}
				/>
				<CommitControls
					activeCommitData={state.activeCommitData}
					commitData={state.commitData}
					navigationTarget={state.navigationTarget}
					searchQuery={state.searchQuery}
					diffsLoaded={state.diffsLoaded}
					commitFilter={state.commitFilter}
					setCommitFilter={state.setCommitFilter}
					addLinks={state.addLinks}
					setLinks={state.setLinks}
					links={state.links}
				/>
				<CommitInfo
					activeCommitData={state.activeCommitData}
					commitData={state.commitData}
					navigationTarget={state.navigationTarget}
					showFileCommitsClick={state.showFileCommitsClick}
					searchQuery={state.searchQuery}
					repoPrefix={state.repoPrefix}
					diffsLoaded={state.diffsLoaded}
					commitFilter={state.commitFilter}
					setCommitFilter={state.setCommitFilter}
					fileContents={state.fileContents}
					loadFile={state.loadFile}
					loadFileDiff={state.loadFileDiff}
					closeFile={state.closeFile}
					loadDiff={state.loadDiff}
					addLinks={state.addLinks}
					setLinks={state.setLinks}
					links={state.links}
				/>
			</>
		);
	}

	async readData() {
		const commitObj = (await this.api.getType(
			'/repo/fs/' + this.repo + '/log.json',
			{},
			'json'
		)) as RawCommitData;
		this.commitData = parseCommits(commitObj);
		try {
			const deps = (await this.api.getType(
				'/repo/fs/' + this.repo + '/deps.json',
				{},
				'json'
			)) as { modules: { source: string; dependencies: { resolved: string }[] }[] };
			const links: TreeLink[] = [];
			deps.modules.forEach(({ source, dependencies }, i) => {
				const src = '/' + this.repo + '/' + source;
				const color = new THREE.Color().setHSL((i / 7) % 1, 0.5, 0.6);
				dependencies.forEach(({ resolved }) => {
					const dst = '/' + this.repo + '/' + resolved;
					links.push({ src, dst, color });
				});
			});
			const srcIndex = new Map<TreeLinkKey, TreeLink[]>();
			const dstIndex = new Map<TreeLinkKey, TreeLink[]>();
			links.forEach((link) => {
				const { src, dst } = link;
				if (!srcIndex.has(src)) srcIndex.set(src, []);
				srcIndex.get(src)?.push(link);
				if (!dstIndex.has(dst)) dstIndex.set(dst, []);
				dstIndex.get(dst)?.push(link);
			});
			this.dependencies = links;
			this.dependencySrcIndex = srcIndex;
			this.dependencyDstIndex = dstIndex;
		} catch (err) {
			/* No deps */
		}
	}

	async readDir(path: string): Promise<FSEntry> {
		let reqPath = path;
		if (reqPath === '') reqPath = '.';
		if (reqPath[0] === '/') reqPath = '.' + reqPath;
		reqPath += '/';
		const pathBuf: ArrayBuffer = await this.api.postType(
			'/repo/tree',
			{ repo: this.repo, paths: [reqPath], hash: this.ref, recursive: false },
			{},
			'arrayBuffer'
		);
		const tree = utils.parseFileList_(pathBuf, true, '');
		return getPathEntry(tree.tree, path) || tree.tree;
	}

	async readFile(path: string) {
		return this.api.postType(
			'/repo/checkout',
			{ repo: this.repo, path: path.replace(/^\//, ''), hash: this.ref },
			{},
			'arrayBuffer'
		);
	}

	async writeFile(path: string, contents: ArrayBuffer): Promise<boolean> {
		throw new NotImplementedError("montaanGit doesn't support writes");
	}

	async rm(path: string): Promise<boolean> {
		throw new NotImplementedError("montaanGit doesn't support writes");
	}

	async rmdir(path: string): Promise<boolean> {
		throw new NotImplementedError("montaanGit doesn't support writes");
	}
}