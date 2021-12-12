import ServerHelper from './serverhelper';
import {BasicUserInitializer, SVEGroup as SVEBaseGroup, SVEData as SVEBaseData, LoginState, SVEProjectType, SessionUserInitializer, SVESystemState, SVEAccount as SVEBaseAccount, SVEDataInitializer, SVEDataVersion, UserRights, QueryResultType, RawQueryResult, GroupInitializer, ProjectInitializer, SVEProjectState, TokenType, BasicUserLoginInfo, SVEDataType, SVELocalDataInfo, APIStatus} from 'svebaselib';
import {SVEServerAccount as SVEAccount} from './serverBaseLib/SVEServerAccount';
import {Server as SocketIOServer} from 'socket.io';
import {SVEServerSystemInfo as SVESystemInfo} from './serverBaseLib/SVEServerSystemInfo';
import {SVEServerData as SVEData} from './serverBaseLib/SVEServerData';
import {SVEServerGroup as SVEGroup} from './serverBaseLib/SVEServerGroup';
import {SVEServerProject as SVEProject} from './serverBaseLib/SVEServerProject';
import {SVEServerProjectQuery as SVEProjectQuery} from './serverBaseLib/SVEServerProjectQuery';

import { Request, Response, Router, Application } from "express";

import * as fs from "fs";

import {Ranges, Range} from "range-parser";

import HugeUploader from 'huge-uploader-nodejs';
import { mkdir } from 'fs';
import { dirname } from 'path';

const tmpDir = './tmp';
mkdir(tmpDir, (err) => {const x = 0;});
const router = Router();

ServerHelper.setupRouter(router);

router.get('/check', (req: Request, res: Response) => {
    const status: APIStatus = {
        status: SVESystemInfo.getSystemStatus().basicSystem && SVESystemInfo.getSystemStatus().tokenSystem,
        version: "2.0"
    };

    SVEAccount.getByRequest(req).then((user) => {
        status.loggedInAs = {
            id: user.getID(),
            loginState: user.getLoginState(),
            name: user.getName(),
            sessionID: ""
        };
        res.json(status);
    }, err => {
        res.json(status);
    });
});

router.get('/groups', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        SVEGroup.getGroupsOf(user).then((val: SVEBaseGroup[]) => {
            const list: number[] = [];
            val.forEach((g: SVEBaseGroup) => list.push(g.getID()));
            res.json(list);
        }, (err: any) => {
            res.json(err);
        });
    }, err => {
        res.sendStatus(401);
    });
});

router.get('/query/:query', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        const query = decodeURI(req.params.query as string);
        SVEProjectQuery.query(query, user).then((results) => {
            const resList: RawQueryResult[] = [];
            results.forEach(res => {
                const typ = (res.constructor.name === SVEProject.name) ? QueryResultType.Project : QueryResultType.Group;
                resList.push({
                    typ: typ,
                    id: res.getID(),
                    distance: SVEProjectQuery.getDistanceOf(res)
                });
            });
            res.json(resList);
        });
    }, err => {
        res.sendStatus(401);
    });
});

router.get('/group/:id([\\+\\-]?\\d+)/rights', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        const idx = Number(req.params.id);
        const g = new SVEGroup({id: idx}, user, (group?: SVEBaseGroup) => {
            if(group !== undefined && !isNaN(group.getID())) {
                group.getRightsForUser(user).then((rights) => {
                    res.json(rights);
                });
            } else {
                res.sendStatus(404);
            }
        });
    }, err => {
        res.sendStatus(401);
    });
});

router.put('/group/:id([\\+\\-]?\\d+)/user/:uid([\\+\\-]?\\d+)/rights', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        const gid = Number(req.params.id);
        const uid = Number(req.params.uid);

        const g = new SVEGroup({id: gid}, user, (group?: SVEBaseGroup) => {
            if(group !== undefined && !isNaN(group.getID())) {
                group.getRightsForUser(user).then((rights) => {
                    if(rights.admin) {
                        const a = new SVEAccount({id: uid} as BasicUserInitializer, (reqUser: SVEBaseAccount) => {
                            const newRights = req.body as UserRights;
                            (group as SVEGroup).setRightsForUser(reqUser, newRights).then((val) => {
                                res.sendStatus((val) ? 200 : 500);
                                console.log("Applied new rights: " + JSON.stringify(newRights) + " success: " + val);
                            });
                        });
                    } else {
                        res.sendStatus(401);
                    }
                });
            } else {
                res.sendStatus(404);
            }
        });
    }, err => {
        res.sendStatus(401);
    });
});

router.get('/group/:id([\\+\\-]?\\d+)/user/:uid([\\+\\-]?\\d+)/rights', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        const gid = Number(req.params.id);
        const uid = Number(req.params.uid);

        const g = new SVEGroup({id: gid}, user, (group?: SVEBaseGroup) => {
            if(group !== undefined && !isNaN(group.getID())) {
                group.getRightsForUser(user).then((rights) => {
                    if(rights.read) {
                        const a = new SVEAccount({id: uid} as BasicUserInitializer, (reqUser: SVEBaseAccount) => {
                            group.getRightsForUser(reqUser).then((reqRights) => {
                                res.json(reqRights);
                            });
                        });
                    } else {
                        res.sendStatus(401);
                    }
                });
            } else {
                res.sendStatus(401);
            }
        });
    }, err => {
        res.sendStatus(401);
    });
});

router.get('/group/:id([\\+\\-]?\\d+)/users', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        const idx = Number(req.params.id);
        const g = new SVEGroup({id: idx}, user, (group?: SVEBaseGroup) => {
            if(group !== undefined && !isNaN(group.getID())) {
                group.getRightsForUser(user).then((rights) => {
                    if(rights.read) {
                        group.getUsers().then(usrs => {
                            res.json(usrs);
                        }, err => res.sendStatus(500));
                    } else {
                        res.sendStatus(401);
                    }
                });
            } else {
                res.sendStatus(404);
            }
        });
    }, err => {
        res.sendStatus(401);
    });
});

router.delete('/group/:id([\\+\\-]?\\d+)', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        const idx = Number(req.params.id);
        const g = new SVEGroup({id: idx}, user, (group?: SVEBaseGroup) => {
            if (group === undefined || isNaN(group.getID())) {
                res.sendStatus(404);
            } else {
                group.getRightsForUser(user).then(rights => {
                    if(rights.admin) {
                        console.log("Delete: " + group.getName());
                        (group as SVEGroup).remove().then(val => {
                            res.sendStatus((val) ? 204 : 500);
                        });
                    } else {
                        res.sendStatus(401);
                    }
                });
            }
        });
    }, err => {
        res.sendStatus(401);
    });
});

router.put('/group/:id([\\+\\-]?\\d+|new)', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        if (req.params.id !== "new") {
            const idx = Number(req.params.id);
            const g = new SVEGroup({id: idx}, user, (group?: SVEBaseGroup) => {
                (group! as SVEGroup).setName(req.body.name);
                group!.store().then(val => {
                    if(val) {
                        res.json({
                            name: group!.getName(),
                            id: group!.getID()
                        });
                    } else {
                        res.sendStatus(500);
                    }
                });
            });
        } else {
            if(req.body.name !== undefined) {
                const g = new SVEGroup({name: req.body.name, id: NaN} as GroupInitializer, user, (group?: SVEBaseGroup) => {
                    if(group === undefined) {
                        res.sendStatus(403);
                    } else {
                        (group! as SVEGroup).store().then(val => {
                            if(val) {
                                console.log("Created new group: " + group!.getName());
                                res.json({
                                    name: group!.getName(),
                                    id: group!.getID()
                                } as GroupInitializer);
                            } else {
                                res.sendStatus(500);
                            }
                        });
                    }
                });
            } else {
                res.sendStatus(400);
                console.log("Incorrect body to create new group!");
            }
        }
    }, err => {
        res.sendStatus(401);
    });
});

router.get('/group/:id([\\+\\-]?\\d+)', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        const idx = Number(req.params.id);
        const g = new SVEGroup({id: idx}, user, (group?: SVEBaseGroup) => {
            if(group !== undefined && !isNaN(group.getID())) {
                group.getRightsForUser(user).then((rights) => {
                    if(rights.read) {
                        group.getProjects().then((prjs) => {
                            const list: number[] = [];
                            prjs.forEach(p => list.push(p.getID()));
                            res.json({
                                group: {
                                    id: group.getID(),
                                    name: group.getName()
                                },
                                projects: list
                            });
                        }, (err) => {
                            res.json({
                                group: group,
                                projects: [],
                                err: err
                            });
                        });
                    } else {
                        res.sendStatus(401);
                    }
                }, err => res.sendStatus(500));
            } else {
                res.sendStatus(404);
            }
        });
    }, err => {
        res.sendStatus(401);
    });
});

router.put('/project/:prj([\\+\\-]?\\d+|new)', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        if (req.params.prj !== "new") {
            const idx: number = Number(req.params.prj);
            const p = new SVEProject(idx as number, user, (self) => {
                self.getGroup().getRightsForUser(user).then(rights => {
                    self.setName(req.body.name);
                    self.setType(req.body.type as SVEProjectType);

                    if(req.body.dateRange !== undefined)
                        self.setDateRange({ begin: new Date(req.body.dateRange.begin), end: new Date(req.body.dateRange.end) });

                    if(rights.admin)
                        self.setState(req.body.state);

                    if(req.body.splashImg !== undefined)
                        self.setSplashImgID(Number(req.body.splashImg));

                    if(rights.admin)
                        self.setResult((req.body.result !== undefined) ? Number(req.body.result) : undefined);

                    (self as SVEProject).store().then(val => {
                        console.log("Updated Project: " + self.getName());
                        if(val) {
                            res.json(self.getAsInitializer());
                        } else {
                            res.sendStatus(401);
                        }
                    });
                });
            });
        } else {
            const g = new SVEGroup({id: Number(req.body.group.id)}, user, (group) => {
                const p = new SVEProject({
                    id: NaN,
                    group: group,
                    name: req.body.name, 
                    owner: user,
                    splashImg: req.body.splashImg,
                    result: req.body.result,
                    type: req.body.type as SVEProjectType,
                    state: req.body.state as SVEProjectState,
                    dateRange: (req.body.dateRange !== undefined) ? { begin: new Date(req.body.dateRange.begin), end: new Date(req.body.dateRange.end) } : undefined
                } as ProjectInitializer, user, (project) => {
                    (project as SVEProject).store().then(val => {
                        console.log("Created new Project: " + project.getName());
                        if(val) {
                            res.json(project.getAsInitializer());
                        } else {
                            res.sendStatus(500);
                        }
                    });
                });
            });
        }
    }, err => {
        res.sendStatus(401);
    });
});

router.delete('/project/:prj([\\+\\-]?\\d+)', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        const idx: number = Number(req.params.prj);
        const p = new SVEProject(idx as number, user, (self) => {
            (self as SVEProject).remove().then(success => {
                if(success) {
                    res.sendStatus(204);
                } else {
                    res.sendStatus(401);
                }
            }, err => res.sendStatus(500));
        });
    }, err => {
        res.sendStatus(401);
    });
});

router.get('/project/:id([\\+\\-]?\\d+)', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        const idx: number = Number(req.params.id);
        const p = new SVEProject(idx as number, user, (self) => {
            if (isNaN(self.getID())) {
                res.sendStatus(404);
            } else {
                try {
                    self.getGroup().getRightsForUser(user).then(val => {
                        if(val.read) {
                            const init: any = self.getAsInitializer();
                            init.group = init.group.getID();
                            init.owner = (typeof init.owner !== "number") ? init.owner.getID() : init.owner;
                            res.json(init);
                        } else {
                            res.sendStatus(401);
                        }
                    }, err => res.sendStatus(500));
                } catch (error) {
                    res.sendStatus(404);
                }
            }
        });
    }, err => {
        res.sendStatus(401);
    });
});

router.get('/project/:id([\\+\\-]?\\d+)/data', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        const idx = Number(req.params.id);
        const p = new SVEProject(idx, user, (self) => {
            if(self !== undefined && !isNaN(self.getID())) {
                self.getGroup().getRightsForUser(user).then(val => {
                    if (val.read) {
                        self.getData().then((data) => {
                            const list: SVEDataInitializer[] = [];
                            data.forEach(d => { list.push({
                                    id: d.getID(),
                                    type: d.getType(),
                                    owner: d.getOwnerID(),
                                    name: d.getName()
                                } as SVEDataInitializer)
                            });
                            res.json(list);
                        }, (err) => {
                            res.sendStatus(500);
                        });
                    } else {
                        res.sendStatus(401);
                    }
                }, err => res.sendStatus(500));
            } else {
                res.sendStatus(404);
            }
        });
    }, err => {
        res.sendStatus(401);
    });
});

interface FileRequest {
    OK: boolean,
    range?: Range
}

function setFileRequestHeaders(file: SVEData, fetchType: string, res: Response, req: Request): FileRequest {
    const version = (fetchType === "download" || fetchType === "full") ? SVEDataVersion.Full : SVEDataVersion.Preview;
    const total = file.getSize(version);
    const resHead: any = {
        'Cache-Control': file.getCacheType(),
        'Content-Type': file.getContentType(version),
        'Accept-Ranges': 'bytes',
        //'Connection': "keep-alive",
        'Content-Length': total,
        'Content-Disposition': (fetchType == "download") ? 'attachment; filename=' + file.getName() : 'inline'
    };
    let retCode = 200;

    const r = req.range(total);// max file size
    let range: Range | undefined = (r !== undefined && r !== -1 && r !== -2 && (r as Ranges).length > 0) ? r[0] : undefined;
    if(range !== undefined) {
        const start = (range.start && !isNaN(range.start)) ? range.start : 0;
        const end = (range.end && !isNaN(range.end)) ? range.end : total - 1;
        const chunksize = (end - start) + 1;
        resHead['Content-Range'] = "bytes " + start + "-" + end + "/" + total;
        resHead['Content-Length'] = chunksize;
        retCode = 206;
        if (start >= total || end >= total) {
            retCode = 416;
            resHead['Content-Range'] = "bytes */" + total;
        } else {
            range = {
                start: start,
                end: end
            };
        }
    } else {
        range = {
            start: 0,
            end: total - 1
        };
    }
    res.writeHead(retCode, resHead);

    return {
        OK: retCode !== 416,
        range: range
    };
}

router.head('/project/:id([\\+\\-]?\\d+)/data/:fid([\\+\\-]?\\d+)/:fetchType(|full|preview|download)', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        const pid = Number(req.params.id);
        const fid = Number(req.params.fid);
        const fetchType = req.params.fetchType as string || "full";
        const p = new SVEProject(pid, user, (project) => {
            if(project !== undefined && !isNaN(project.getID())) {
                project.getGroup().getRightsForUser(user).then(val => {
                    if (val.read) {
                        (project as SVEProject).getDataById(fid).then(file => {
                            setFileRequestHeaders(file, fetchType, res, req);
                        });
                    } else {
                        res.sendStatus(401);
                    }
                });
            }
        });
    }, err => {
        res.sendStatus(401);
    });
});

router.get('/project/:id([\\+\\-]?\\d+)/data/:fid([\\+\\-]?\\d+)/:fetchType(|full|preview|download)', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        const pid = Number(req.params.id);
        const fid = Number(req.params.fid);
        const fetchType = req.params.fetchType as string || "full";
        const p = new SVEProject(pid, user, (self) => {
            if(self !== undefined && !isNaN(self.getID())) {
                self.getGroup().getRightsForUser(user).then(val => {
                    if (val.read) {
                        (self as SVEProject).getDataById(fid).then(file => {
                            const fReq = setFileRequestHeaders(file, fetchType, res, req);
                            if (fReq.OK) {
                                file.getStream(
                                    (fetchType === "download" || fetchType === "full") ? SVEDataVersion.Full : SVEDataVersion.Preview,
                                    fReq.range
                                ).then(stream => {
                                    stream.pipe(res);
                                }, err => {
                                    console.log("Error in stream of file: " + fid + " (" + JSON.stringify(err) + ")!");
                                    //res.sendStatus(416)
                                });
                            }
                        }, err => res.sendStatus(404));
                    } else {
                        res.sendStatus(401);
                    }
                }, err => res.sendStatus(500));
            } else {
                res.sendStatus(404);
            }
        });
    }, err => {
        res.sendStatus(401);
    });
});

function move(oldPath: string, newPath: string, callback: (err?:any) => void) {
    fs.mkdir(dirname(newPath), {recursive: true}, (err) => {
        fs.rename(oldPath, newPath, (err) => {
            if (err) {
                if (err.code === 'EXDEV') {
                    copy();
                } else {
                    callback(err);
                }
                return;
            }
            callback();
        });
    
        function copy() {
            const readStream = fs.createReadStream(oldPath);
            const writeStream = fs.createWriteStream(newPath);
    
            readStream.on('error', callback);
            writeStream.on('error', callback);
    
            readStream.on('close', () => {
                fs.unlink(oldPath, callback);
            });
    
            readStream.pipe(writeStream);
        }
    });
}

router.delete('/project/:id([\\+\\-]?\\d+)/data/:fid([\\+\\-]?\\d+)', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        const pid = Number(req.params.id);
        const fid = Number(req.params.fid);
        const p = new SVEProject(pid, user, (self) => {
            if(self !== undefined && !isNaN(self.getID())) {
                self.getGroup().getRightsForUser(user).then(val => {
                    if (val.write) {
                        (self as SVEProject).getDataById(fid).then(file => {
                            file.remove().then(val => {
                                res.sendStatus((val) ? 200 : 500);
                            });
                        });
                    } else {
                        res.sendStatus(401);
                    }
                });
            } else {
                res.sendStatus(404);
            }
        });
    }, err => {
        res.sendStatus(401);
    });
});

router.get('/project/:id([\\+\\-]?\\d+)/data/zip', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        const idx = Number(req.params.id);
        const p = new SVEProject(idx, user, (prj) => {
            prj.getGroup()!.getRightsForUser(user).then(val => {
                if (val.read) {
                    const files: any = [];
                    const ownerNames: Map<number, string> = new Map<number, string>();
                    let fCount = 0;

                    const finalizeDownload = () => {
                        try {
                            (res as any).zip({
                                files: files,
                                filename: "Urlaub_" + prj.getName() + ".zip"
                            });
                        } catch {
                            console.log("Zip streaming failed!");
                            res.sendStatus(500);
                        }
                    };

                    const addFile = (file: SVEData, owner: string) => {
                        files.push({
                            path: file.getLocalPath(SVEDataVersion.Full),
                            name: owner + "/" + file.getName()
                        });
                    };

                    prj.getData().then(data => {
                        data.forEach((d: SVEBaseData) => {
                            if (!ownerNames.has(d.getOwnerID())) {
                                d.getOwner().then(owner => {
                                    ownerNames.set(owner.getID(), owner.getName());
                                    addFile(d, owner.getName());
                                    fCount++;
                                    if(fCount === data.length) {
                                        finalizeDownload();
                                    }
                                });
                            } else {
                                fCount++;
                                addFile(d, ownerNames.get(d.getOwnerID())!);
                                if(fCount === data.length) {
                                    finalizeDownload();
                                }
                            }
                        });
                    });
                } else {
                    res.sendStatus(401);
                }
            });
        });
    }, err => {
        res.sendStatus(401);
    });
});

router.put('/project/:id([\\+\\-]?\\d+)/data/upload', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        const idx = Number(req.params.id);
        const p = new SVEProject(idx, user, (prj) => {
            prj.getGroup()!.getRightsForUser(user).then(val => {
                if (val.write) {
                    const d = new SVEData(user, {
                        id: NaN,
                        type: SVEData.getTypeFrom(req.body.fileName as string),
                        owner: user,
                        parentProject: prj,
                        path: { filePath: "", thumbnailPath: "" } as SVELocalDataInfo,
                        name: req.body.fileName as string,
                    } as SVEDataInitializer, (data) => {
                        res.json({
                            id: data.getID(),
                            type: data.getType(),
                            parentProject: data.getProject()
                        } as SVEDataInitializer);
                    });
                } else {
                    res.sendStatus(401);
                }
            });
        });
    }, err => {
        res.sendStatus(401);
    });
});

router.post('/project/:id([\\+\\-]?\\d+)/data/upload', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        const idx = Number(req.params.id);
        const p = new SVEProject(idx, user, (prj) => {
            prj.getGroup()!.getRightsForUser(user).then(val => {
                if (val.write) {
                    HugeUploader(req, tmpDir, 9999, 50).then((assembleChunks) => {
                        res.writeHead(204, 'No Content');
                        res.end();
                        if (assembleChunks) {
                            assembleChunks().then(data => {
                                const postProcessing = async() => {
                                    const fileDest = (prj as SVEProject).getDataPath() + "/" + user.getName() + "/" + data.postParams.fileName;
                                    move(data.filePath, fileDest, (err) => {
                                        if(err) {
                                            console.log("Error on copy: " + JSON.stringify(err));
                                        } else {
                                            console.log("Received file: " + JSON.stringify(data.postParams));
                                            const d = new SVEData(user, {
                                                id: (data.postParams.fid !== undefined && data.postParams.fid != "undefined") ? Number(data.postParams.fid) : undefined,
                                                type: SVEData.getTypeFromExt(fileDest), 
                                                owner: user, parentProject: prj, 
                                                path: {filePath: fileDest, thumbnailPath: ""},
                                                creation: (data.postParams.created !== undefined && data.postParams.created != "undefined") ? new Date(Number(data.postParams.created)) : new Date()
                                            } as SVEDataInitializer, (data: SVEBaseData) => {
                                                (data as SVEData).store().then(val => {
                                                    if(!val) {
                                                        console.log("Error on file post-processing!");
                                                    }
                                                }, err => console.log(err));
                                            });
                                        }
                                    });
                                };
                                postProcessing().catch(err => {});
                            }).catch(err => console.log(err));
                        }
                    }).catch((err) => {
                        console.log("File receive error: " + JSON.stringify(err));
                        res.status(400);
                    });
                } else {
                    res.sendStatus(401);
                }
            }, err => res.sendStatus(500));
        });
    }, err => {
        res.sendStatus(401);
    });
});

router.get('/data/latest', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        SVEData.getLatestUpload(user).then(data => {
            if (data.getID() < 0) {
                res.sendStatus(404);
            } else {
                res.json({
                    id: data.getID(),
                    type: data.getType(),
                    project: (data.getProject() !== undefined) ? data.getProject().getID() : undefined,
                    name: data.getName(),
                    owner: data.getOwnerID(),
                    creation: data.getCreationDate(),
                    lastAccess: data.getLastAccessDate()
                });
            }
        }, err => res.sendStatus(404));
    }, err => {
        res.sendStatus(401);
    });
});

router.get('/data/:id([\\+\\-]?\\d+)', (req: Request, res: Response) => {
    SVEAccount.getByRequest(req).then((user) => {
        const idx = Number(req.params.id);
        const d = new SVEData(user, idx, (self) => {
            if (self.getID() < 0) {
                res.sendStatus(404);
            } else {
                res.json({
                    id: self.getID(),
                    type: self.getType(),
                    project: (self.getProject() !== undefined) ? self.getProject().getID() : undefined,
                    name: self.getName(),
                    owner: self.getOwnerID(),
                    creation: self.getCreationDate(),
                    lastAccess: self.getLastAccessDate()
                });
            }
        });
    }, err => {
        res.sendStatus(401);
    });
});

class Initializer {
    public static init(app: Application, sio?: SocketIOServer) {
        app.use("/", router)
    }
}

export {
    Initializer
};