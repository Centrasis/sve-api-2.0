import {BasicUserInitializer, SVEAccount, SVEDataVersion, SVEData, SVELocalDataInfo, SVEProject as SVEBaseProject, SVEGroup, SVESystemInfo, SVEDataInitializer} from 'svebaselib';
import { Stream } from 'stream';
import {SVEServerProject as SVEProject} from './SVEServerProject';
import mysql from 'mysql';
import {Range} from "range-parser";
import * as fs from "fs";

export class SVEServerData extends SVEData {

    // gets the data by index if initInfo is number. Else a new data record is created on server
    public constructor(handler: SVEAccount, initInfo: number | SVEDataInitializer, onComplete: (self: SVEData) => void) {
        super(handler, initInfo, (self) => {
            if (typeof initInfo === "number") {
                if (typeof SVESystemInfo.getInstance().sources.persistentDatabase !== "string") {
                    (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM files WHERE id = ?", [self.getID()], (err, results) => {
                        if(err || results.length === 0) {
                            onComplete(self);
                        } else {
                            if(results[0].project !== undefined && results[0].project !== null) {
                                let parentProject = new SVEProject(results[0].project as number, handler, (prj) => {
                                    if (prj.getGroup() !== undefined) {
                                        prj.getGroup()!.getRightsForUser(handler).then((val) => {
                                            if(!val.read) {
                                                onComplete(self);
                                            } else {
                                                async () => self.initFromResult(results[0], parentProject, () => { onComplete(self); });
                                            }
                                        });
                                    } else {
                                        async () => self.initFromResult(results[0], parentProject, () => { onComplete(self); });
                                    }
                                });
                            } else {
                                async () => self.initFromResult(results[0], undefined, () => { onComplete(self); });
                            }
                        }
                    });
                }
            } else {
                onComplete(self);
            }
        });
    }

    public getBLOB(version: SVEDataVersion): Promise<ArrayBuffer> {
        if(this.localDataInfo !== undefined && this.data === undefined) {
            this.currentDataVersion = version;
            this.data = fs.readFileSync((version === SVEDataVersion.Full) ? this.localDataInfo.filePath : this.localDataInfo.thumbnailPath);
        }
        return super.getBLOB(version);
    }

    public getSize(version: SVEDataVersion): number {
        let size = 0;
        if(this.localDataInfo !== undefined) {
            let stats = fs.statSync((version === SVEDataVersion.Full) ? this.localDataInfo.filePath : this.localDataInfo.thumbnailPath);
            size = stats["size"];
        }

        return size;
    }

    public getStream(version: SVEDataVersion, fileRange?: Range): Promise<Stream> {
        if(this.localDataInfo !== undefined) {
            this.currentDataVersion = version;
            this.data = fs.createReadStream(
                (version === SVEDataVersion.Full) ? this.localDataInfo.filePath : this.localDataInfo.thumbnailPath, 
                {
                    start: (fileRange !== undefined) ? fileRange.start : undefined,
                    end: (fileRange !== undefined) ? fileRange.end : undefined,
                }
            );
        }
        
        return super.getStream(version);
    }
}