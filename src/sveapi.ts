import ServerHelper from './serverhelper';
import {BasicUserInitializer, SVEGroup as SVEBaseGroup, LoginState, SVEDataType, SessionUserInitializer, SVESystemState, SVEAccount as SVEBaseAccount, SVEDataInitializer, SVEDataVersion} from 'svebaselib';
import {SVEServerAccount as SVEAccount} from './serverBaseLib/SVEServerAccount';

import {SVEServerSystemInfo as SVESystemInfo} from './serverBaseLib/SVEServerSystemInfo';
import {SVEServerData as SVEData} from './serverBaseLib/SVEServerData';
import {SVEServerGroup as SVEGroup} from './serverBaseLib/SVEServerGroup';
import {SVEServerProject as SVEProject} from './serverBaseLib/SVEServerProject';
import {apiVersion as authVersion} from './authenticator';
import { Stream } from 'stream';
import { Console } from 'console';

var express = require('express');
var router = express.Router();
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

router.get('/check', function (req: any, res: any) {
    let status: APIStatus = {
        status: SVESystemInfo.getSystemStatus(),
        version: {
            fileAPI: apiVersion,
            authAPI: authVersion
        } 
    };

    if (req.session.user) {
        new SVEAccount(req.session.user as SessionUserInitializer, (user: SVEBaseAccount) => {
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

router.get('/groups', function (req: any, res: any) {
    if (req.session.user) {
        SVEGroup.getGroupsOf(new SVEAccount(req.session.user as SessionUserInitializer)).then((val: SVEBaseGroup[]) => {
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

router.get('/group/:id/rights', function (req: any, res: any) {
    if (req.session.user) {
        let idx = req.params.id as number;
        new SVEAccount(req.session.user as SessionUserInitializer, (user: SVEBaseAccount) => {
            new SVEGroup(idx, new SVEAccount(req.session.user as SessionUserInitializer), (group?: SVEBaseGroup) => {
                if(group !== undefined && group.getID() != NaN) {
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

router.get('/group/:id/users', function (req: any, res: any) {
    if (req.session.user) {
        let idx = req.params.id as number;
        new SVEAccount(req.session.user as SessionUserInitializer, (user: SVEBaseAccount) => {
            new SVEGroup(idx, new SVEAccount(req.session.user as SessionUserInitializer), (group?: SVEBaseGroup) => {
                if(group !== undefined && group.getID() != NaN) {
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

router.get('/group/:id', function (req: any, res: any) {
    if (req.session.user) {
        let idx = req.params.id as number;
        new SVEAccount(req.session.user as SessionUserInitializer, (user: SVEBaseAccount) => {
            new SVEGroup(idx, new SVEAccount(req.session.user as SessionUserInitializer), (group?: SVEBaseGroup) => {
                if(group !== undefined && group.getID() != NaN) {
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

router.put('/project/:prj(\\d+|new)', function (req: any, res: any) {
    res.sendStatus(401);
});

router.delete('/project/:prj(\\d+)', function (req: any, res: any) {
    if (req.session.user) {
        let idx: number = Number(req.params.id);
        new SVEAccount(req.session.user as SessionUserInitializer, (user) => {
            new SVEProject(idx as number, user, (self) => {
                self.remove().then(success => {
                    if(success) {
                        res.sendStatus(200);
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

router.get('/project/:id(\\d+)', function (req: any, res: any) {
    if (req.session.user) {
        let idx: number = Number(req.params.id);
        new SVEAccount(req.session.user as SessionUserInitializer, (user) => {
            new SVEProject(idx as number, user, (self) => {
                if (self.getID() === NaN) {
                    res.sendStatus(404);
                } else {
                    try {
                        self.getGroup().getRightsForUser(user).then(val => {
                            if(val.read) {
                                res.json({
                                    id: self.getID(),
                                    group: self.getGroup().getID(),
                                    owner: (self as SVEProject).getOwnerID(),
                                    type: self.getType(),
                                    name: self.getName(),
                                    splashImgID: self.getSplashImgID(),
                                    dateRange: self.getDateRange(),
                                    state: self.getState()
                                });
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

router.get('/project/:id/data', function (req: any, res: any) {
    if (req.session.user) {
        let idx = Number(req.params.id);
        new SVEAccount(req.session.user as SessionUserInitializer, (user) => {
            new SVEProject(idx, user, (self) => {
                if(self !== undefined && self.getID() != NaN) {
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

router.get('/project/:id/data/:fid(\\d+)/:fetchType(|full|preview|download)', function (req: any, res: any) {
    if (req.session.user) {
        let pid = Number(req.params.id);
        let fid = Number(req.params.fid);
        let fetchType = req.params.fetchType as string || "full";
        new SVEAccount(req.session.user as SessionUserInitializer, (user) => {
            new SVEProject(pid, user, (self) => {
                if(self !== undefined && self.getID() != NaN) {
                    self.getGroup().getRightsForUser(user).then(val => {
                        if (val.read) {
                            (self as SVEProject).getDataById(fid).then(file => {
                                file.getStream((fetchType == "download" || fetchType == "full") ? SVEDataVersion.Full : SVEDataVersion.Preview).then(stream => {
                                    res.set({
                                        'Cache-Control': file.getCacheType(),
                                        'Content-Type': file.getContentType(),
                                        'Content-Disposition': (fetchType == "download") ? 'attachment; filename=' + file.getName() : 'inline'
                                    });
                                    stream.pipe(res);
                                }, err => {
                                    console.log("Error in stream of file: " + fid + "!");
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

router.post('/project/:id/data/upload', function (req: any, res: any) {
    if (req.session.user) {
        let idx = Number(req.params.id);
        let fileType: SVEDataType = req.body.type as SVEDataType;
        new SVEAccount(req.session.user as SessionUserInitializer, (user) => {
            new SVEProject(idx, user, (prj) => {
                prj.getGroup()!.getRightsForUser(user).then(val => {
                    if (val.write) {
                        resumable.post(req, (status: string, filename: string, original_filename: string, identifier: string) => {
                            if (status === "complete") {
                                new SVEData(user, {
                                    data: new ArrayBuffer(0),
                                    parentProject: prj,
                                    type: fileType
                                }, (data) => {
                                    res.send(status, {
                                    });
                                });
                            } else {
                                res.send(status, {
                                });
                            }
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

router.get('/project/:id/data/upload', function (req: any, res: any) {
    resumable.get(req, function(status: string, filename: string, original_filename: string, identifier: string){
        console.log('GET', status);
        res.send((status == 'found' ? 200 : 404), status);
    });
});

router.get('/data/:id', function (req: any, res: any) {
    if (req.session.user) {
        let idx = req.params.id as number;
        new SVEAccount(req.session.user as SessionUserInitializer, (user) => {
            new SVEData(user, idx, (self) => {
                if (self.getID() < 0) {
                    res.sendStatus(401);
                } else {
                    res.json({
                        id: self.getID(),
                        type: self.getType(),
                        project: self.getProject(),
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

/*router.get('/data/:id/stream', function (req: any, res: any) {
    if (req.session.user) {
        let idx = req.params.id as number;
        new SVEAccount(req.session.user as SessionUserInitializer, (user) => {
            new SVEData(user, idx, (self) => {
                if (self.getID() < 0) {
                    res.sendStatus(401);
                } else {
                    self.getStream().then((val: Stream) => {
                        res.sendStatus(200);
                        res.set({
                            'Cache-Control': self.getCacheType(),
                            'Content-Type': self.getContentType(),
                            'Content-Disposition': 'inline'
                        });
                        val.pipe(res);
                    }, (err) => {
                        res.sendStatus(500);
                    });
                }
            });
        });
    } else {
        res.sendStatus(401);
    }
});

router.get('/data/:id/download', function (req: any, res: any) {
    if (req.session.user) {
        let idx = req.params.id as number;
        new SVEAccount(req.session.user as SessionUserInitializer, (user) => {
            new SVEData(user, idx, (self) => {
                if (self.getID() < 0) {
                    res.sendStatus(401);
                } else {
                    self.getBLOB().then((val: ArrayBuffer) => {
                        res.sendStatus(200);
                        res.set({
                            'Cache-Control': self.getCacheType(),
                            'Content-Type': self.getContentType(),
                            'Content-Length': val.byteLength,
                            'Content-Disposition': 'attachment; filename=' + self.getName()
                        });
                    }, (err) => {
                        res.sendStatus(500);
                    });
                }
            });
        });
    } else {
        res.sendStatus(401);
    }
});*/

router.get('/user/:id', function (req: any, res: any) {
    if (req.session.user) {
        let idx = req.params.id as number;
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

router.post('/doLogin', function (req: any, res: any) {
    let acc: SVEAccount;
    const onLogin = (user: SVEBaseAccount) => {
        if (user.getState() !== LoginState.NotLoggedIn) {
            acc.setSessionID(req.session.id);
            req.session.user = acc;
            console.log("Logged in user: " + req.session.user.getName());
            res.json({
                success: user.getState() !== LoginState.NotLoggedIn,
                user: acc.getName(),
                id: acc.getID()
            });
        } else {
            req.session.user = undefined;
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