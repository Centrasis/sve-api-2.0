import {BasicUserInitializer, SVEAccount, SVEProjectType, SVEProject as SVEBaseProject, ProjectInitializer, SVESystemInfo, SVEGroup, UserRights, SessionUserInitializer, LoginState, GroupInitializer} from 'svebaselib';
import {SVEServerProject as SVEProject} from './SVEServerProject';
import mysql from 'mysql';
import { parseJsonSourceFileConfigFileContent, textChangeRangeIsUnchanged } from 'typescript';

export class SVEServerGroup extends SVEGroup {
    public getProjects(): Promise<SVEBaseProject[]> {
        if (SVESystemInfo.getIsServer()) {
            return new Promise<SVEBaseProject[]>((resolve, reject) => {
                let ret: SVEBaseProject[] = [];
                (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM projects WHERE context = ?", [this.id], (err, results) => {
                    if(err) {
                        console.log("SQL error on getting SVE Projects!");
                        reject({
                            success: false,
                            msg: err
                        });
                    } else {
                        let i = 0;
                        results.forEach(element => {
                            let init: ProjectInitializer = {
                                group: this,
                                name: element.name,
                                splashImg: element.splash_img,
                                id: element.id,
                                resultsURI: element.results_uri,
                                state: element.state,
                                type: SVEProjectType.Vacation,
                                owner: element.owner
                            };
                            ret.push(new SVEProject(init, this.handler!, (p) => {
                                i++;
                                if (i >= results.length) {
                                    resolve(ret);
                                }
                            }));
                        });
                        if (results.length == 0) {
                            resolve([]);
                        }
                    }
                });
            });
        } else {
            return super.getProjects();        
        }
    }

    public getUsers(): Promise<SVEAccount[]> {
        return new Promise<SVEAccount[]>((resolve, reject) => {
            let users: SVEAccount[] = [];
            (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT user_id, name FROM user INNER JOIN rights ON user.id = rights.user_id WHERE read_access = 1 AND context = ?", [this.id], (err, results) => {
                if(err) {
                    reject(err);
                } else {
                    results.forEach(element => {
                        users.push(new SVEAccount({id: element.user_id, name: element.name, loginState: LoginState.NotLoggedIn, sessionID: ""} as SessionUserInitializer));
                    });
                    resolve(users);
                }
            });
        });
    }

    protected saveAsNewGroup(init: GroupInitializer): Promise<GroupInitializer> {
        return new Promise<GroupInitializer>((resolve, reject) => {
            (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("INSERT INTO contexts (`context`) VALUES (?)", [init.name!], (err, results) => {
                if(err) {
                    console.log("Error in SQL: " + JSON.stringify(err));
                    reject(err);
                } else {
                    (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM contexts WHERE context = ?", [init.name!], (err, results) => {
                        if(err) {
                            console.log("Error in SQL: " + JSON.stringify(err));
                            reject(err);
                        } else {
                            this.id = results[0].id;
                            this.name = results[0].context;
                            this.setRightsForUser(this.handler!, {admin: true, write: true, read: true}).then(val => resolve(this.getAsInitializer()));
                        }
                    });
                }
            });
        });
    }

    public store() {
        return new Promise<boolean>((resolve, reject) => {
            if(isNaN(this.id) || this.id == null) {
                this.saveAsNewGroup(this.getAsInitializer()).then(gi => resolve(true), err => reject(err));
            } else {
                (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("UPDATE contexts SET `context` = ? WHERE id = ?", [this.name, this.id], (err, results) => {
                    if(err) {
                        reject(err);
                    } else {
                        resolve(true);
                    }
                });
            }
        });
    }

    // remove from server
    public remove(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.getProjects().then(projects => {
                projects.forEach(p => (p as SVEProject).remove());
                
                (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("DELETE FROM rights WHERE context = ?", [this.id], (err, res) => {});
                (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("DELETE FROM contexts WHERE id = ?", [this.id], (err, res) => {
                    if(err) {
                        console.log("DELETING GROUP ERROR: " + JSON.stringify(err));
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                });
            });
        });
    }

    public setRightsForUser(handler: SVEAccount, rights: UserRights): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM rights WHERE context = ? AND user_id = ?", [this.id, handler.getID()], (err, res) => {
                if(err || res.length === 0) {
                    (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("INSERT INTO rights (context, user_id, write_access, read_access, admin_access) VALUES (?, ?, ?, ?, ?)", [this.id, handler.getID(), rights.write, rights.read, rights.admin], (err, results) => {
                        if(err) {
                            resolve(false);
                        } else {
                            resolve(true);
                        }
                    });
                } else {
                    (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("UPDATE rights SET write_access = ?, read_access = ?, admin_access = ? WHERE user_id = ? AND context = ?", [rights.write, rights.read, rights.admin, handler.getID(), this.id], (err, results) => {
                        if(err) {
                            resolve(false);
                        } else {
                            resolve(true);
                        }
                    });
                }
            });
        });
    }

    public getRightsForUser(handler: SVEAccount): Promise<UserRights> {
        if (SVESystemInfo.getIsServer()) {
            return new Promise<UserRights>((resolve, reject) => {
                (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT user_id, context as context_id, write_access, read_access, admin_access FROM user INNER JOIN rights ON user.id = rights.user_id WHERE user_id = ? AND context = ?", [handler.getID(), this.id], (err, results) => {
                    if(err || results.length == 0) {
                        reject(err);
                    } else {
                        resolve({
                            read: results[0].read_access === 1,
                            write: results[0].write_access === 1,
                            admin: results[0].admin_access === 1
                        });
                    }
                });
            });
        } else {
            return super.getRightsForUser(handler);
        }
    }

    public constructor(init: GroupInitializer, handler: SVEAccount, onReady?: (self?: SVEGroup) => void) {
        super(init, handler, (self) => {
            if (SVESystemInfo.getIsServer()) {
                if(init.id !== undefined && !isNaN(init.id)) {
                    (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM contexts WHERE id = ?", [init.id!], (err, results) => {
                        if(err) {
                            console.log("Error in SQL: " + JSON.stringify(err));
                            if(onReady !== undefined)
                                onReady!(undefined);
                        } else {
                            this.id = init.id!;
                            this.name = results[0].context;
                            this.handler = handler;

                            if(onReady !== undefined)
                                onReady!(this);
                        }
                    });
                } else {
                    (self as SVEServerGroup).handler = handler;
                    (self as SVEServerGroup).saveAsNewGroup(init).then(i => {
                        onReady!(this);
                    }, err => onReady!(undefined));
                }
            }
        });
    }

    public setName(newName: string) {
        this.name = newName;
    }

    public static getGroupsOf(handler: SVEAccount): Promise<SVEGroup[]> {
        if (SVESystemInfo.getIsServer()) {
            return new Promise<SVEGroup[]>((resolve, reject) => {
                let ret: SVEGroup[] = [];
                (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT user_id, context as context_id, write_access, read_access, admin_access FROM user INNER JOIN rights ON user.id = rights.user_id WHERE user_id = ? AND read_access = 1", [handler.getID()], (err, results) => {
                    if(err) {
                        console.log("SQL error on getting SVE Groups!");
                        reject({
                            success: false,
                            msg: err
                        });
                    } else {
                        let i = 0;
                        results.forEach((element: any) => {
                            ret.push(new SVEServerGroup({id: element.context_id}, handler, (s) => {
                                i++;
                                if(i >= results.length) {
                                    resolve(ret);
                                }
                            }));
                        });
                        if (results.length == 0) {
                            resolve([]);
                        }
                    }
                });
            });
        } else {
            return super.getGroupsOf(handler);
        }
    }
};