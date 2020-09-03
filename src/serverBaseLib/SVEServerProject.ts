import {BasicUserInitializer, SVEProject, SVEDataInitializer, ProjectInitializer, SVEAccount as SVEBaseAccount, isProjectInitializer, SVEDataType} from 'svebaselib';
import {SVEServerGroup as SVEGroup} from './SVEServerGroup';
import {SVEServerAccount as SVEAccount} from './SVEServerAccount';
import {SVEServerSystemInfo as SVESystemInfo} from './SVEServerSystemInfo';
import mysql from 'mysql';
import { SVEServerData as SVEData } from './SVEServerData';

export class SVEServerProject extends SVEProject {
    public constructor(idx: number | ProjectInitializer, handler: SVEBaseAccount, onReady?: (self: SVEProject) => void) {
        super(idx, handler, (self) => {
            // if get by id from DB
            if (!isProjectInitializer(idx) && SVESystemInfo.getIsServer()) {
                (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM projects WHERE id = ?", [idx as number], (err, results) => {
                    if(err) {
                        this.id = NaN;
                        console.log("SQL ERROR ON GET PROJECT BY ID ON SERVER: " + JSON.stringify(err));
                        if (onReady !== undefined)
                            onReady!(this);
                    } else {
                        if (results.length === 0) {
                            this.id = NaN;
                            if (onReady !== undefined)
                                onReady!(this);
                        } else {
                            this.id = idx as number;
                            this.name = results[0].name;
                            this.handler = handler;
                            this.group = new SVEGroup(results[0].context, handler, (s) => {
                                this.owner = results[0].owner as number;
                                if (onReady !== undefined)
                                    onReady!(self);
                            });
                        }
                    }
                });
            } else {
                if (onReady !== undefined)
                    onReady!(self);
            }
        });
    }

    public getGroup(): SVEGroup {
        return this.group! as SVEGroup;
    }

    public getDataById(fid: number): Promise<SVEData> {
        return new Promise<SVEData>((resolve, reject) => { 
            (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM files WHERE (project = ? OR project IS NULL) AND id = ?", [this.id, fid], (err, results) => {
                if(err) {
                    console.log("SQL ERROR ON FILES: " + JSON.stringify(err));
                    reject(null);
                } else {
                    if (results.length === 1) {
                        new SVEData(this.handler!, {parentProject: this, type: SVEData.getTypeFrom(results[0].type), id: results[0].id, path: {filePath: results[0].path, thumbnailPath: results[0].thumbnail}, owner: results[0].user_id} as SVEDataInitializer, (s) => {
                            resolve(s);
                        });
                    } else {
                        reject(null);
                    }
                }
            });
        });
    }

    public getData(): Promise<SVEData[]> {
        if (SVESystemInfo.getIsServer()) {
            return new Promise<SVEData[]>((resolve, reject) => { 
                (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM files WHERE project = ?", [this.id], (err, results) => {
                    if(err) {
                        console.log("SQL ERROR ON FILES: " + JSON.stringify(err));
                        reject(null);
                    } else {
                        let r: SVEData[] = [];
                        let i = 0;
                        results.forEach(element => {
                            r.push(new SVEData(this.handler!, {parentProject: this, type: SVEData.getTypeFrom(element.type), id: element.id, path: {filePath: element.path, thumbnailPath: element.thumbnail}, owner: element.user_id} as SVEDataInitializer, (s) => {
                                i++;
                                if (i >= results.length) {
                                    resolve(r);
                                }
                            }));
                        });

                        if(results.length === 0) {
                            resolve(r);
                        }
                    }
                });
            });
        } else {
            return super.getData();
        }
    }

    public getOwner(): Promise<SVEBaseAccount> {
        if (typeof this.owner! === "number") {
            return new Promise<SVEBaseAccount>((resolve, reject) => {
                this.owner = new SVEAccount({id: this.owner! as number} as BasicUserInitializer, (s) => { 
                    resolve(this.owner! as SVEBaseAccount);
                });
            });
        } else {
            return super.getOwner();
        }
    }

    public getOwnerID(): number {
        if (typeof this.owner! === "number") {
            return this.owner! as number;
        } else {
            return (this.owner! as SVEAccount).getID();
        }
    }
}