import ServerHelper from './serverhelper';
import {BasicUserInitializer, SVEGroup as SVEBaseGroup, SVEData as SVEBaseData, LoginState, SVEProjectType, SessionUserInitializer, SVESystemState, SVEAccount as SVEBaseAccount, SVEDataInitializer, SVEDataVersion, UserRights, QueryResultType, RawQueryResult, GroupInitializer, ProjectInitializer} from 'svebaselib';
import {SVEServerAccount as SVEAccount} from './serverBaseLib/SVEServerAccount';

import {SVEServerSystemInfo as SVESystemInfo} from './serverBaseLib/SVEServerSystemInfo';
import {SVEServerData as SVEData} from './serverBaseLib/SVEServerData';
import {SVEServerGroup as SVEGroup} from './serverBaseLib/SVEServerGroup';
import {SVEServerProject as SVEProject} from './serverBaseLib/SVEServerProject';
import {SVEServerProjectQuery as SVEProjectQuery} from './serverBaseLib/SVEServerProjectQuery';
import {apiVersion as authVersion} from './authenticator';

import { Request, Response, Router } from "express";

import * as fs from "fs";

import {Ranges} from "range-parser";

import * as formidable from "formidable";
import {Fields, File, Files, Part, } from "formidable";
import HugeUploader from 'huge-uploader-nodejs';
import { copyFile, mkdir } from 'fs';
import { dirname } from 'path';
import { group } from 'console';

const tmpDir = './tmp';
mkdir(tmpDir, (err) => {});
var router = Router();
var resumable = require("resumable");
const apiVersion = 1.0;

ServerHelper.setupRouter(router);

interface APIVersion {
    fileAPI: Number;
    authAPI: Number;
}

interface APIStatus {
    status: SVESystemState,
    version: APIVersion,
    loggedInAs?: SessionUserInitializer
}

router.get('/check', function (req: Request, res: Response) {
    let status: APIStatus = {
        status: SVESystemInfo.getSystemStatus(),
        version: {
            fileAPI: apiVersion,
            authAPI: authVersion
        } 
    };

    if (req.session!.user) {
        new SVEAccount(req.session!.user as SessionUserInitializer, (user: SVEBaseAccount) => {
            status.loggedInAs = {
                id: user.getID(),
                loginState: user.getLoginState(),
                name: user.getName(),
                sessionID: ""
            };
            res.json(status);
        });
    } else {
        res.json(status);
    }
});

router.get('/groups', function (req: Request, res: Response) {
    if (req.session!.user) {
        SVEGroup.getGroupsOf(new SVEAccount(req.session!.user as SessionUserInitializer)).then((val: SVEBaseGroup[]) => {
            let list: number[] = [];
            val.forEach((g: SVEBaseGroup) => list.push(g.getID()));
            res.json(list);
        }, (err: any) => {
            res.json(err);
        })
    } else {
        res.sendStatus(401);
    }
});

router.get('/query/:query', function (req: Request, res: Response) {
    if (req.session!.user) {
        let query = decodeURI(req.params.query as string);
        new SVEAccount(req.session!.user as SessionUserInitializer, (user: SVEBaseAccount) => {
            SVEProjectQuery.query(query, user).then((results) => {
                let resList: RawQueryResult[] = [];
                results.forEach(res => {
                    let typ = (res.constructor.name === SVEProject.name) ? QueryResultType.Project : QueryResultType.Group;
                    resList.push({
                        typ: typ,
                        id: res.getID(),
                        distance: SVEProjectQuery.getDistanceOf(res)
                    });
                });
                res.json(resList);
            });
        });
    } else {
        res.sendStatus(401);
    }
});

router.get('/group/:id([\\+\\-]?\\d+)/rights', function (req: Request, res: Response) {
    if (req.session!.user) {
        let idx = Number(req.params.id);
        new SVEAccount(req.session!.user as SessionUserInitializer, (user: SVEBaseAccount) => {
            new SVEGroup({id: idx}, new SVEAccount(req.session!.user as SessionUserInitializer), (group?: SVEBaseGroup) => {
                if(group !== undefined && !isNaN(group.getID())) {
                    group.getRightsForUser(user).then((rights) => {
                        res.json(rights);
                    });
                } else {
                    res.sendStatus(404);
                }
            });
        });
    } else {
        res.sendStatus(401);
    }
});

router.put('/group/:id([\\+\\-]?\\d+)/user/:uid([\\+\\-]?\\d+)/rights', function (req: Request, res: Response) {
    if (req.session!.user) {
        let gid = Number(req.params.id);
        let uid = Number(req.params.uid);

        new SVEAccount(req.session!.user as SessionUserInitializer, (user: SVEBaseAccount) => {
            new SVEGroup({id: gid}, new SVEAccount(req.session!.user as SessionUserInitializer), (group?: SVEBaseGroup) => {
                if(group !== undefined && !isNaN(group.getID())) {
                    group.getRightsForUser(user).then((rights) => {
                        if(rights.admin) {
                            new SVEAccount({id: uid} as BasicUserInitializer, (reqUser: SVEBaseAccount) => {
                                let newRights = req.body as UserRights;
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
        });
    } else {
        res.sendStatus(401);
    }
});

router.get('/group/:id([\\+\\-]?\\d+)/user/:uid([\\+\\-]?\\d+)/rights', function (req: Request, res: Response) {
    if (req.session!.user) {
        let gid = Number(req.params.id);
        let uid = Number(req.params.uid);

        new SVEAccount(req.session!.user as SessionUserInitializer, (user: SVEBaseAccount) => {
            new SVEGroup({id: gid}, new SVEAccount(req.session!.user as SessionUserInitializer), (group?: SVEBaseGroup) => {
                if(group !== undefined && !isNaN(group.getID())) {
                    group.getRightsForUser(user).then((rights) => {
                        if(rights.read) {
                            new SVEAccount({id: uid} as BasicUserInitializer, (reqUser: SVEBaseAccount) => {
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
        });
    } else {
        res.sendStatus(401);
    }
});

router.get('/group/:id([\\+\\-]?\\d+)/users', function (req: Request, res: Response) {
    if (req.session!.user) {
        let idx = Number(req.params.id);
        new SVEAccount(req.session!.user as SessionUserInitializer, (user: SVEBaseAccount) => {
            new SVEGroup({id: idx}, new SVEAccount(req.session!.user as SessionUserInitializer), (group?: SVEBaseGroup) => {
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
        });
    } else {
        res.sendStatus(401);
    }
});

router.delete('/group/:id([\\+\\-]?\\d+)', function (req: Request, res: Response) {
    if (req.session!.user) {
        new SVEAccount(req.session!.user as SessionUserInitializer, (user: SVEBaseAccount) => {
            let idx = Number(req.params.id);
            new SVEGroup({id: idx}, user, (group?: SVEBaseGroup) => {
                if (group === undefined) {
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
        });
    } else {
        res.sendStatus(401);
    }
});

router.put('/group/:id([\\+\\-]?\\d+|new)', function (req: Request, res: Response) {
    if (req.session!.user) {
        new SVEAccount(req.session!.user as SessionUserInitializer, (user: SVEBaseAccount) => {
            if (req.params.id !== "new") {
                let idx = Number(req.params.id);
                new SVEGroup({id: idx}, user, (group?: SVEBaseGroup) => {
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
                    new SVEGroup({name: req.body.name, id: NaN} as GroupInitializer, user, (group?: SVEBaseGroup) => {
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
        });
    } else {
        res.sendStatus(401);
    }
});

router.get('/group/:id([\\+\\-]?\\d+)', function (req: Request, res: Response) {
    if (req.session!.user) {
        let idx = Number(req.params.id);
        new SVEAccount(req.session!.user as SessionUserInitializer, (user: SVEBaseAccount) => {
            new SVEGroup({id: idx}, user, (group?: SVEBaseGroup) => {
                if(group !== undefined && !isNaN(group.getID())) {
                    group.getRightsForUser(user).then((rights) => {
                        if(rights.read) {
                            group.getProjects().then((prjs) => {
                                let list: number[] = [];
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
        });
    } else {
        res.sendStatus(401);
    }
});

router.put('/project/:prj([\\+\\-]?\\d+|new)', function (req: Request, res: Response) {
    if (req.session!.user) {
        if (req.params.prj !== "new") {
            let idx: number = Number(req.params.prj);
            new SVEAccount(req.session!.user as SessionUserInitializer, (user) => {
                new SVEProject(idx as number, user, (self) => {
                    self.setName(req.body.name);
                    self.setType(req.body.type as SVEProjectType);
                    if(req.body.dateRange !== undefined)
                        self.setDateRange({ begin: new Date(req.body.dateRange.begin), end: new Date(req.body.dateRange.end) });
                    self.setState(req.body.state);
                    if(req.body.splashImg !== undefined)
                        self.setSplashImgID(Number(req.body.splashImg));
                    self.store().then(val => {
                        if(val) {
                            res.json(self.getAsInitializer());
                        } else {
                            res.sendStatus(500);
                        }
                    });
                });
            });
        } else {
            new SVEAccount(req.session!.user as SessionUserInitializer, (user) => {
                new SVEGroup({id: Number(req.body.group.id)}, user, (group) => {
                    new SVEProject({
                        id: NaN,
                        group: group,
                        name: req.body.name, 
                        owner: user,
                        splashImg: 0,
                        type: req.body.type,
                        state: req.body.state,
                        dateRange: (req.body.dateRange !== undefined) ? { begin: new Date(req.body.dateRange.begin), end: new Date(req.body.dateRange.end) } : undefined
                    } as ProjectInitializer, user, (project) => {
                        (project as SVEProject).store().then(val => {
                            if(val) {
                                res.json(project.getAsInitializer());
                            } else {
                                res.sendStatus(500);
                            }
                        });
                    });
                });
            });
        }
    } else {
        res.sendStatus(401);
    }
});

router.delete('/project/:prj([\\+\\-]?\\d+)', function (req: Request, res: Response) {
    if (req.session!.user) {
        let idx: number = Number(req.params.prj);
        new SVEAccount(req.session!.user as SessionUserInitializer, (user) => {
            new SVEProject(idx as number, user, (self) => {
                (self as SVEProject).remove().then(success => {
                    if(success) {
                        res.sendStatus(204);
                    } else {
                        res.sendStatus(401);
                    }
                }, err => res.sendStatus(500));
            });
        });
    } else {
        res.sendStatus(401);
    }
});

router.get('/project/:id([\\+\\-]?\\d+)', function (req: Request, res: Response) {
    if (req.session!.user) {
        let idx: number = Number(req.params.id);
        new SVEAccount(req.session!.user as SessionUserInitializer, (user) => {
            new SVEProject(idx as number, user, (self) => {
                if (isNaN(self.getID())) {
                    res.sendStatus(404);
                } else {
                    try {
                        self.getGroup().getRightsForUser(user).then(val => {
                            if(val.read) {
                                let init: any = self.getAsInitializer();
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
        });
    } else {
        res.sendStatus(401);
    }
});

router.get('/project/:id([\\+\\-]?\\d+)/data', function (req: Request, res: Response) {
    if (req.session!.user) {
        let idx = Number(req.params.id);
        new SVEAccount(req.session!.user as SessionUserInitializer, (user) => {
            new SVEProject(idx, user, (self) => {
                if(self !== undefined && !isNaN(self.getID())) {
                    self.getGroup().getRightsForUser(user).then(val => {
                        if (val.read) {
                            self.getData().then((data) => {
                                let list: SVEDataInitializer[] = [];
                                data.forEach(d => { list.push({
                                        id: d.getID(),
                                        type: d.getType(),
                                        owner: d.getOwnerID()
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
        });
    } else {
        res.sendStatus(401);
    }
});

function setFileRequestHeaders(file: SVEData, fetchType: string, res: Response) {
    res.set({
        'Cache-Control': file.getCacheType(),
        'Content-Type': file.getContentType(),
        'Accept-Ranges': 'bytes',
        'Content-Length': file.getSize((fetchType == "download" || fetchType == "full") ? SVEDataVersion.Full : SVEDataVersion.Preview),
        'Content-Disposition': (fetchType == "download") ? 'attachment; filename=' + file.getName() : 'inline'
    });
}

router.head('/project/:id([\\+\\-]?\\d+)/data/:fid([\\+\\-]?\\d+)/:fetchType(|full|preview|download)', function (req: Request, res: Response) {
    if (req.session!.user) {
        let pid = Number(req.params.id);
        let fid = Number(req.params.fid);
        let fetchType = req.params.fetchType as string || "full";
        new SVEAccount(req.session!.user as SessionUserInitializer, (user) => {
            new SVEProject(pid, user, (self) => {
                if(self !== undefined && !isNaN(self.getID())) {
                    self.getGroup().getRightsForUser(user).then(val => {
                        (self as SVEProject).getDataById(fid).then(file => {
                            setFileRequestHeaders(file, fetchType, res);
                        });
                    });
                }
            });
        });
    } else {
        res.sendStatus(401);
    } 
});

router.get('/project/:id([\\+\\-]?\\d+)/data/:fid([\\+\\-]?\\d+)/:fetchType(|full|preview|download)', function (req: Request, res: Response) {
    if (req.session!.user) {
        let pid = Number(req.params.id);
        let fid = Number(req.params.fid);
        let fetchType = req.params.fetchType as string || "full";
        new SVEAccount(req.session!.user as SessionUserInitializer, (user) => {
            new SVEProject(pid, user, (self) => {
                if(self !== undefined && !isNaN(self.getID())) {
                    self.getGroup().getRightsForUser(user).then(val => {
                        if (val.read) {
                            // check range request
                            let range: Ranges | undefined | -1 | -2 = req.range(1e+9); // max one GB
                            (self as SVEProject).getDataById(fid).then(file => {
                                file.getStream(
                                    (fetchType == "download" || fetchType == "full") ? SVEDataVersion.Full : SVEDataVersion.Preview,
                                    (range !== undefined && range !== -1 && range !== -2 && (range as Ranges).length > 0) ? (range as Ranges)[0] : undefined
                                ).then(stream => {
                                    setFileRequestHeaders(file, fetchType, res);
                                    stream.pipe(res);
                                }, err => {
                                    console.log("Error in stream of file: " + fid + " (" + JSON.stringify(err) + ")!");
                                    res.sendStatus(500)
                                });
                            }, err => res.sendStatus(404));
                        } else {
                            res.sendStatus(401);
                        }
                    }, err => res.sendStatus(500));
                } else {
                    res.sendStatus(404);
                }
            });
        });
    } else {
        res.sendStatus(401);
    }
});

function move(oldPath: string, newPath: string, callback: (err?:any) => void) {
    fs.mkdir(dirname(newPath), {recursive: true}, (err) => {
        fs.rename(oldPath, newPath, function (err) {
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
            var readStream = fs.createReadStream(oldPath);
            var writeStream = fs.createWriteStream(newPath);
    
            readStream.on('error', callback);
            writeStream.on('error', callback);
    
            readStream.on('close', function () {
                fs.unlink(oldPath, callback);
            });
    
            readStream.pipe(writeStream);
        }
    });
}

router.delete('/project/:id([\\+\\-]?\\d+)/data/:fid([\\+\\-]?\\d+)', function (req: Request, res: Response) {
    if (req.session!.user) {
        let pid = Number(req.params.id);
        let fid = Number(req.params.fid);
        new SVEAccount(req.session!.user as SessionUserInitializer, (user) => {
            new SVEProject(pid, user, (self) => {
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
        });
    } else {
        res.sendStatus(401);
    }
});

router.get('/project/:id([\\+\\-]?\\d+)/data/zip', function (req: Request, res: Response) {
    if (req.session!.user) {
        let idx = Number(req.params.id);
        new SVEAccount(req.session!.user as SessionUserInitializer, (user) => {
            new SVEProject(idx, user, (prj) => {
                prj.getGroup()!.getRightsForUser(user).then(val => {
                    if (val.read) {
                        let files: any = [];
                        let ownerNames: Map<number, string> = new Map<number, string>();
                        let fCount = 0;

                        let finalizeDownload = () => {
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

                        let addFile = (file: SVEData, owner: string) => {
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
        });
    } else {
        res.sendStatus(401);
    }
});

router.post('/project/:id([\\+\\-]?\\d+)/data/upload', function (req: Request, res: Response) {
    if (req.session!.user) {
        let idx = Number(req.params.id);
        new SVEAccount(req.session!.user as SessionUserInitializer, (user) => {
            new SVEProject(idx, user, (prj) => {
                prj.getGroup()!.getRightsForUser(user).then(val => {
                    if (val.write) {
                        HugeUploader(req, tmpDir, 9999, 50).then((assembleChunks) => {
                            res.writeHead(204, 'No Content');
                            res.end();
                            if (assembleChunks) {
                                assembleChunks().then(data => {
                                    let postProcessing = async() => {
                                        let fileDest = SVESystemInfo.getInstance().sources.sveDataPath! + "/" + prj.getGroup().getName() + "/" + prj.getName() + "/" + user.getName() + "/" + data.postParams.fileName;
                                        move(data.filePath, fileDest, (err) => {
                                            if(err) {
                                                console.log("Error on copy: " + JSON.stringify(err));
                                            } else {
                                                console.log("Received file: " + JSON.stringify(data.postParams));
                                                new SVEData(user, {
                                                    type: SVEData.getTypeFromExt(fileDest), 
                                                    owner: user, parentProject: prj, 
                                                    path: {filePath: fileDest, thumbnailPath: ""},
                                                    creation: (data.postParams.created !== undefined && data.postParams.created != "undefined") ? new Date(Number(data.postParams.created)) : new Date()
                                                } as SVEDataInitializer, (data: SVEBaseData) => {
                                                    data.store().then(val => {
                                                        if(!val)
                                                            console.log("Error on file post-processing!");
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
        });
    } else {
        res.sendStatus(401);
    }
});

router.get('/data/:id([\\+\\-]?\\d+)', function (req: Request, res: Response) {
    if (req.session!.user) {
        let idx = Number(req.params.id);
        new SVEAccount(req.session!.user as SessionUserInitializer, (user) => {
            new SVEData(user, idx, (self) => {
                if (self.getID() < 0) {
                    res.sendStatus(401);
                } else {
                    res.json({
                        id: self.getID(),
                        type: self.getType(),
                        project: self.getProject(),
                        name: self.getName(),
                        owner: self.getOwnerID(),
                        creation: self.getCreationDate(),
                        lastAccess: self.getLastAccessDate()
                    });
                }
            });
        });
    } else {
        res.sendStatus(401);
    }
});

router.get('/user/:id([\\+\\-]?\\d+)', function (req: Request, res: Response) {
    if (req.session!.user) {
        let idx = Number(req.params.id);
        let user = new SVEAccount({id: idx} as BasicUserInitializer, (state) => {
            res.json({
                id: user.getID(),
                loginState: user.getLoginState(),
                name: user.getName()
            });
        });
    } else {
        res.sendStatus(401);
    }
});

router.post('/doLogin', function (req: Request, res: Response) {
    let acc: SVEAccount;
    const onLogin = (user: SVEBaseAccount) => {
        if (user.getState() !== LoginState.NotLoggedIn) {
            acc.setSessionID(req.session!.id);
            req.session!.user = acc;
            console.log("Logged in user: " + req.session!.user.getName());
            res.json({
                success: user.getState() !== LoginState.NotLoggedIn,
                user: acc.getName(),
                id: acc.getID()
            });
        } else {
            req.session!.user = undefined;
            res.json({
                success: false,
                user: ""
            });
        }
    };

    if (req.body.user && typeof req.body.user === "string") {
        if (req.body.token) {
            acc = new SVEAccount({
                name: req.body.user as string, 
                token:req.body.token as string
            }, onLogin);
        } else {
            acc = new SVEAccount({
                name: req.body.user as string, 
                pass:req.body.pw as string
            }, onLogin);
        }
    } else {
        res.sendStatus(400);
    }
});

export {
    router
};