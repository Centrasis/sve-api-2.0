import {BasicUserInitializer, SVEProject, SVEDataInitializer, ProjectInitializer, SVEAccount as SVEBaseAccount, isProjectInitializer, SVEProjectState, SVEProjectType} from 'svebaselib';
import {SVEServerGroup as SVEGroup} from './SVEServerGroup';
import {SVEServerAccount as SVEAccount} from './SVEServerAccount';
import {SVEServerSystemInfo as SVESystemInfo} from './SVEServerSystemInfo';
import mysql from 'mysql';
import { SVEServerData as SVEData } from './SVEServerData';

export class SVEServerProject extends SVEProject {
    protected dataPath: string = "";

    public constructor(idx: number | ProjectInitializer, handler: SVEBaseAccount, onReady?: (self: SVEProject) => void) {
        super(idx, handler, (self) => {
            // if get by id from DB
            if (!isProjectInitializer(idx) && SVESystemInfo.getIsServer()) {
                (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT projects.id as id, name, context, splash_img, owner, state, data_path as path, result, begin_point, end_point, type FROM (projects LEFT JOIN documentProjects ON id = project) LEFT OUTER JOIN events ON projects.id = project_id WHERE projects.id = ?", [idx as number], (err, results) => {
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
                            this.dataPath = results[0].path;
                            if (results[0].result !== null && results[0].result !== undefined) {
                                this.result = results[0].result;
                            }
                            this.state = (results[0].state == "open") ? SVEProjectState.Open : SVEProjectState.Closed;
                            if (results[0].type !== null && results[0].type !== undefined) {
                                this.type = (results[0].type === "Sales") ? SVEProjectType.Sales : SVEProjectType.Documents;
                            }

                            if (results[0].begin_point != null && results[0].begin_point != undefined) {
                                this.dateRange = {
                                    begin: new Date(results[0].begin_point),
                                    end: (results[0].end_point != null && results[0].end_point != undefined) ? new Date(results[0].end_point) : new Date()
                                };
                            }

                            this.handler = handler;

                            this.group = new SVEGroup({id: results[0].context}, handler, (s) => {
                                this.owner = results[0].owner as number;

                                if (results[0].splash_img !== undefined && results[0].splash_img !== null) {
                                    this.splashImgID = Number(results[0].splash_img);
                                    if (onReady !== undefined)
                                        onReady!(self);
                                } else {
                                    this.splashImgID = 0;
                                    (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT min(id) as id FROM `files` WHERE `project` = ?", [idx as number], (err, selresults) => {
                                        if (err || selresults === undefined) {
                                            if (onReady !== undefined)
                                                onReady!(self);

                                                return;
                                        }
                                        
                                        if(selresults.length > 0) {
                                            this.splashImgID = Number(selresults[0].id);
                                        }
                                        if (onReady !== undefined)
                                            onReady!(self);
                                    });
                                }
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

    public getDataPath(): string {
        return this.dataPath;
    }

    public getGroup(): SVEGroup {
        return this.group! as SVEGroup;
    }

    protected saveDateRange(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            if(this.dateRange === undefined) {
                resolve(true);
            } else {
                (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM events WHERE `project_id` = ?", [this.id], (err, results) => {
                    if(err) {
                        console.log("ERROR SELECTING EVENTS: " + JSON.stringify(err));
                        resolve(false);
                    } else {
                        if(results.length === 0) {
                            (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("INSERT INTO events (`project_id`, `begin_point`, `end_point`) VALUES (?, FROM_UNIXTIME(?), FROM_UNIXTIME(?))", [this.id, Math.round(this.dateRange!.begin.getTime() / 1000), Math.round(this.dateRange!.end.getTime() / 1000)], (err, results) => {
                                if(err) {
                                    console.log("ERROR INSERTING EVENT: " + JSON.stringify(err));
                                    resolve(false);
                                } else {
                                    resolve(true);
                                }
                            });
                        } else {
                            (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("UDPATE events SET `begin_point`=FROM_UNIXTIME(?), `end_point`=FROM_UNIXTIME(?) WHERE `project_id`=?", [Math.round(this.dateRange!.begin.getTime() / 1000), Math.round(this.dateRange!.end.getTime() / 1000), this.id], (err, results) => {
                                if(err) {
                                    console.log("ERROR UPDATING EVENT: " + JSON.stringify(err));
                                    resolve(false);
                                } else {
                                    resolve(true);
                                }
                            });
                        }
                    }
                });
            }
        });
    }

    protected saveType(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            if(this.type === SVEProjectType.Vacation) {
                resolve(true);
            } else {
                (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM `documentProjects` WHERE `project` = ?", [this.id], (err, results) => {
                    if(err) {
                        console.log("ERROR SELECTING documentProjects: " + JSON.stringify(err));
                        resolve(false);
                    } else {
                        if(results.length === 0 || results.length === undefined) {
                            (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("INSERT INTO `documentProjects` (`project`, `type`) VALUES (?, ?)", [this.id, (this.type === SVEProjectType.Sales) ? "Sales" : "Documents"], (err, results) => {
                                if(err) {
                                    console.log("ERROR INSERTING documentProjects: " + JSON.stringify(err));
                                    resolve(false);
                                } else {
                                    resolve(true);
                                }
                            });
                        } else {
                            (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("UPDATE `documentProjects` SET `type`=? WHERE `project`=?", [(this.type === SVEProjectType.Sales) ? "Sales" : "Documents", this.id], (err, results) => {
                                if(err) {
                                    console.log("ERROR UPDATING documentProjects: " + JSON.stringify(err));
                                    resolve(false);
                                } else {
                                    resolve(true);
                                }
                            });
                        }
                    }
                });
            }
        });
    }

    protected static charConversionTable = new Map<string, string>([
        ["á", "a"], 
        ["à", "a"],
        ["ä", "ae"],
        ["â", "a"],
        ["ü", "ue"],
        ["ú", "u"],
        ["ù", "u"],
        ["û", "u"],
        ["ö", "oe"],
        ["ó", "o"],
        ["ò", "o"],
        ["ô", "o"],
        ["ß", "ss"],
        ["í", "i"],
        ["ì", "i"],
        ["î", "i"],
        ["*", "_"],
        ["+", "_"],
        ["#", "_"],
        ["|", "_"],
        ["?", "_"],
        [" ", "_"],
        ["!", "_"],
        ["\"", "_"],
        [",", "_"]
    ]);

    protected getFSConformName(): string {
        let ret = this.name;
        SVEServerProject.charConversionTable.forEach((val, key, map) => {
            ret = ret.replace(key, val);
        });
        return ret;
    }

    public store(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.group!.getRightsForUser(this.handler!).then(rights => {
                if (rights.write) {
                    if (isNaN(this.id) || this.id == null) {
                        (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT MAX(id) as id FROM projects", (err, results) => {
                            if(err) {
                                reject(err);
                            } else {
                                this.id = ((results.length > 0) ? Number(results[0].id) : 0) + 1;
                                (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("INSERT INTO projects (`id`, `name`, `context`, `owner`, `state`, `data_path`, `result`) VALUES (?, ?, ?, ?, ?, ?, ?)", [this.id, this.name, this.group!.getID(), (typeof this.owner! === "number") ? this.owner : (this.owner! as SVEAccount).getID(), 'open', SVESystemInfo.getInstance().sources.sveDataPath + "/" + this.getFSConformName(), this.result], (err, results) => {
                                    if(err) {
                                        reject(err);
                                    } else {
                                        this.saveDateRange().then(v => {
                                            this.saveType().then(v => resolve(v));
                                        });
                                    };
                                });
                            }
                        });
                    } else {
                        (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("UPDATE projects SET `name`=?, `state`=?, `result`=? WHERE id = ?", [this.name, (this.state === SVEProjectState.Open) ? 'open' : 'closed', this.result, this.id], (err, results) => {
                            if(err) {
                                reject(err);
                            } else {
                                this.saveDateRange().then(v => {
                                    this.saveType().then(v => resolve(v));
                                });
                            }
                        });
                    }
                } else {
                    resolve(false);
                }
            });
        });
    }

    public remove(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.group!.getRightsForUser(this.handler!).then(rights => {
                if (rights.admin) {
                    this.getData().then(data => {
                        data.forEach(d => d.remove());
                        (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("DELETE FROM projects WHERE `id` = ?", [this.id], (err, results) => {
                            if(err) {
                                reject(err);
                            } else {
                                resolve(true);
                            }
                        });
                    });
                } else {
                    resolve(false);
                }
            });
        });
    }

    public getDataById(fid: number): Promise<SVEData> {
        return new Promise<SVEData>((resolve, reject) => { 
            (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM files WHERE (`project` = ? OR `project` IS NULL) AND `id` = ?", [this.id, fid], (err, results) => {
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
                (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM files WHERE `project` = ?", [this.id], (err, results) => {
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