import {BasicUserInitializer, SVEAccount, SVEDataVersion, SVEData, SVELocalDataInfo, SVEProject as SVEBaseProject, SVEGroup, SVESystemInfo, SVEDataInitializer, SVEDataType} from 'svebaselib';
import { Stream } from 'stream';
import {SVEServerProject as SVEProject} from './SVEServerProject';
import mysql from 'mysql';
import {Range} from "range-parser";
import * as fs from "fs";
import * as sharp from "sharp";
import ThumbnailGenerator from 'video-thumbnail-generator';
import { basename, dirname, join } from 'path';

export class SVEServerData extends SVEData {

    // gets the data by index if initInfo is number. Else a new data record is created on server
    public constructor(handler: SVEAccount, initInfo: number | SVEDataInitializer, onComplete: (self: SVEData) => void) {
        super(handler, initInfo, (self) => {
            if (typeof initInfo === "number") {
                if (typeof SVESystemInfo.getInstance().sources.persistentDatabase !== "string") {
                    (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM files WHERE id = ?", [initInfo], (err, results) => {
                        if(err || results.length === 0) {
                            onComplete(self);
                        } else {
                            if(results[0].project !== undefined && results[0].project !== null) {
                                new SVEProject(results[0].project as number, handler, (prj) => {
                                    if (prj.getGroup() !== undefined) {
                                        prj.getGroup()!.getRightsForUser(handler).then((val) => {
                                            if(!val.read) {
                                                onComplete(self);
                                            } else {
                                                self.initFromResult(results[0], prj, () => { onComplete(self); });
                                            }
                                        });
                                    } else {
                                        self.initFromResult(results[0], prj, () => { onComplete(self); });
                                    }
                                });
                            } else {
                                self.initFromResult(results[0], undefined, () => { onComplete(self); });
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

    public remove(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM files WHERE id = ?", [this.id], (err, res) => {
                if(err || res.length == 0) {
                    resolve(false);
                } else {
                    (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("DELETE FROM files WHERE id = ?", [this.id], (err, res) => {
                        fs.unlink(this.localDataInfo!.filePath, (err) => {
                            if (this.localDataInfo!.thumbnailPath.length > 0) {
                                fs.unlink(this.localDataInfo!.thumbnailPath, (err) => {
                                    resolve(true);
                                });
                            } else {
                                resolve(true);
                            }
                        });
                    });
                }
            });
        });
    }

    public store(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            if(this.localDataInfo === undefined) {
                reject();
            }
            if (this.localDataInfo!.thumbnailPath.length == 0 && (this.type === SVEDataType.Image || this.type === SVEDataType.Video)) {
                this.localDataInfo!.thumbnailPath = join(dirname(this.localDataInfo!.filePath), "thumbnails", basename(this.localDataInfo!.filePath) + ".png");
                fs.mkdir(dirname(this.localDataInfo!.thumbnailPath), {recursive: true}, async (err) => {
                    if(err) {
                        console.log("Error creating thumbnail dir: " + JSON.stringify(err));
                    }
                    if(this.type === SVEDataType.Image) {
                        const sizeOf = require('image-size');
                        let dim = sizeOf(this.localDataInfo!.filePath);
                        let size = [0, 0];
                        if(dim.height < dim.width) {
                            size = [320, Math.round(320 * dim.height / dim.width)];
                        } else {
                            size = [Math.round(320 * dim.width / dim.height), 320];
                        }

                        sharp.default(this.localDataInfo!.filePath).resize(size[0], size[1]).png().toFile(this.localDataInfo!.thumbnailPath, 
                            (err, info) => {
                                if (err) {
                                    console.log("Image resize error: " + JSON.stringify(err));
                                }
                            });
                    } else {
                        const getDimensions = require('get-video-dimensions');
                        getDimensions(this.localDataInfo!.filePath).then(dim => {
                            let size = "";
                            if(dim.height < dim.width) {
                                size = "320x" + String(Math.round(320 * dim.height / dim.width));
                            } else {
                                size = String(Math.round(320 * dim.width / dim.height)) + "x320";
                            }

                            const tg = new ThumbnailGenerator({
                                sourcePath: this.localDataInfo!.filePath,
                                thumbnailPath: dirname(this.localDataInfo!.thumbnailPath),
                                size: size
                            });
                            tg.generateGif({
                                fps: 0.75,
                                scale: 180,
                                speedMultiple: 4,
                                deletePalette: true
                            }).then(path => {
                                this.localDataInfo!.thumbnailPath = path;
                                (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("UPDATE files SET `thumbnail` = ? WHERE `path` = ?", [this.localDataInfo!.thumbnailPath, this.localDataInfo!.filePath], (err, res) => {});
                            }).catch(err => {
                                console.log("Generation of thumbnail failed at first pass! Try next pass.. (" + JSON.stringify(err) + ")");

                                /*const ffmpeg = require('ffmpeg-static');
                                const thumbnailer_2 = require('simple-thumbnail');
                                thumbnailer_2(this.localDataInfo!.filePath, this.localDataInfo!.thumbnailPath, size, {
                                    path: ffmpeg.path
                                }).catch(err => {
                                    console.log("Generation of thumbnail failed at second pass! Try last pass..");
                                    let width = Math.round(320 * dim.width / dim.height);
                                    if (width > 320) {
                                        width = 320;
                                    }

                                    let thumbnailer_3 = require('quicklook-thumbnail');
                                    let options = {
                                        size: width,
                                        folder: dirname(this.localDataInfo!.thumbnailPath)
                                    };
                                    thumbnailer_3.create(this.localDataInfo!.filePath, options, (err, path) => {
                                        if(err) {
                                            console.log("Video was too hard to thumbnail! We failed! " + JSON.stringify(err));
                                            (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT id FROM files WHERE path = ?", [this.localDataInfo!.filePath], (err, res) => {
                                                if(!err && res.length > 0) {
                                                    this.id = res[0].id;
                                                    this.remove();
                                                }
                                            });
                                            return;
                                        } else {
                                            this.localDataInfo!.thumbnailPath = path;
                                            (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("UPDATE files SET `thumbnail` = ? WHERE `path` = ?", [this.localDataInfo!.thumbnailPath, this.localDataInfo!.filePath], (err, res) => {});
                                        }
                                    });
                                });*/
                            });
                        }).catch(err => console.log("Failed video dimensions: " + JSON.stringify(err)));
                    }
                });
            }

            (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("DELETE FROM files WHERE path = ?", [this.localDataInfo!.filePath], (err, res) => {
                (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("INSERT INTO files (`project`, `user_id`, `type`, `path`, `thumbnail`, `lastAccess`, `creation`) VALUES (?, ?, ?, ?, ?, ?, ?)", 
                    [
                        this.parentProject!.getID(), 
                        this.getOwnerID(), 
                        SVEData.type2Str(this.getType()), 
                        this.localDataInfo!.filePath, 
                        this.localDataInfo!.thumbnailPath,
                        new Date(),
                        (this.creation !== undefined) ? this.creation : new Date()
                ], (err, results) => {
                    if(err) {
                        reject(err);
                    } else {
                        resolve(true);
                    }
                });
            });
        });
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

    public getLocalPath(version: SVEDataVersion): string {
        if(this.localDataInfo !== undefined) {
            return (version === SVEDataVersion.Full) ? this.localDataInfo.filePath : this.localDataInfo.thumbnailPath;
        } else {
            return "";
        }
    }
}