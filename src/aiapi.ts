import ServerHelper from './serverhelper';
import {SVEServerSystemInfo as SVESystemInfo } from './serverBaseLib/SVEServerSystemInfo';
import {SVEServerData as SVEData } from './serverBaseLib/SVEServerData';
import {BasicUserInitializer, SVEGroup as SVEBaseGroup, SVEData as SVEBaseData, LoginState, SVEProjectType, SessionUserInitializer, SVESystemState, SVEAccount as SVEBaseAccount, SVEDataInitializer, SVEDataVersion, UserRights, QueryResultType, RawQueryResult, GroupInitializer, ProjectInitializer, SVEProjectState, TokenType, BasicUserLoginInfo} from 'svebaselib';
import {SVEServerAccount as SVEAccount, SVEServerRootAccount} from './serverBaseLib/SVEServerAccount';
import { Request, Response, Router } from "express";
import * as tf from '@tensorflow/tfjs-node';
import * as fs from "fs";
import mysql from 'mysql';

const aiModelPath = "/ai/models/";
const imageSize: [number, number] = [224, 224];
var router = Router();
ServerHelper.setupRouter(router);

function getModel(name: string): Promise<tf.LayersModel> {
    if(fs.existsSync(aiModelPath + name + ".json")) {
        return tf.loadLayersModel("file://" + aiModelPath + name + "/model.json");
    } else {
        return new Promise<tf.LayersModel>((resolve, reject) => {
            getClasses().then(classes => {
                console.log("Create model with: " + classes.size + " classes");
                let model = tf.sequential();
                model.add(tf.layers.conv2d({
                    inputShape: [imageSize[0], imageSize[1], 3],
                    filters: 8,
                    kernelSize: 5,
                    strides: 1,
                    activation: 'relu',
                }));
                model.add(tf.layers.maxPooling2d({poolSize: [2, 2], strides: [2, 2]}));
                model.add(tf.layers.flatten());
                model.add(tf.layers.dense({
                    kernelInitializer: 'VarianceScaling',
                    useBias: false,
                    activation: 'softmax',
                    units: classes.size
                }));
                model.compile({
                    optimizer: 'adam',
                    loss: 'categoricalCrossentropy',
                    metrics: ['accuracy']
                });

                resolve(model);
            });
        });
    }
}

function saveModel(name: string, model: tf.LayersModel) {
    if(!fs.existsSync(aiModelPath + name)) {
        fs.mkdirSync(aiModelPath + name);
    }

    model.save("file://" + aiModelPath + name);
}

function fitDataset(model: tf.LayersModel, labels: Map<string, number>, docData: SVEData[], docLabels: string[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        function* data() {
            for (let i = 0; i < docData.length; i++) {
                const file = fs.readFileSync(docData[i].getLocalPath(SVEDataVersion.Preview));
                let tensor = tf.image.resizeBilinear(tf.node.decodeImage(Buffer.from(file.buffer), 3), imageSize);
                yield tensor;
            }
        }

        function* label() {
            for (let i = 0; i < docLabels.length; i++) {
                let lbl = labels.get(docLabels[i])!;
                let v: number[] = [];
                for (let i = 1; i <= labels.size; i++) {
                    v.push((i == lbl) ? 1 : 0);
                }
                let lt = tf.tensor1d(v);
                yield lt;
            }
        }

        const xs = tf.data.generator(data);
        const ys = tf.data.generator(label);
        // We zip the data and labels together, shuffle and batch 32 samples at a time.
        const ds = tf.data.zip({xs, ys}).shuffle(Math.min(100, docData.length) /* bufferSize */).batch(Math.min(32, docData.length), true);
        model.fitDataset(ds, {epochs: 50}).then(info => {
            console.log('Trained model accuracy: ', info.history.acc);
            resolve();
        }, err => { console.log("fitDataset failed: " + JSON.stringify(err)); reject(err); });
    });
}

function getClasses(): Promise<Map<string, number>> {
    return new Promise<Map<string, number>>((resolve, reject) => {
        (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM documentClasses", (err, labels_res) => {
            if(err || labels_res.length === 0) {
                reject(err);
            } else {
                let labels: Map<string, number> = new Map<string, number>();
                labels_res.forEach(element => {
                    labels.set(element.label as string, Number(element.row_num));
                });
                resolve(labels);
            }
        });
    });
}

function trainNewModel(name: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        getModel(name).then(model => {
            getClasses().then(labels => {
                (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM documentLabels ORDER BY fid ASC", (err, docLbls) => {
                    if(err || docLbls.length === 0) {
                        console.log("No labels found!");
                        reject();
                        return;
                    } else {
                        let files: SVEData[] = [];
                        let file_lbs: string[] = [];
                        docLbls.forEach(element => {
                            new SVEData(new SVEServerRootAccount(), Number(element.fid), (data) => {
                                files.push(data);
                                file_lbs.push(element.label as string);
                                if (docLbls.length === files.length) {
                                    console.log("Ready to fit data..");
                                    fitDataset(model, labels, files, file_lbs).then(() => {saveModel(name, model); resolve();}).catch(err => console.log("Error on fit: " + JSON.stringify(err)));
                                }
                            });
                        });
                    }
                });
            }, err => { console.log("Error on load classes: " + JSON.stringify(err)); reject(); });
        }, err => { console.log("Error on load model: " + JSON.stringify(err)); reject(); });
    });
}

router.get("/models/:name/:file", (req, res) => {
    if (req.session!.user) {
        let file = decodeURI(req.params.file as string);
        let name = decodeURI(req.params.name as string);

        if(!(file.startsWith(".") || file.includes(".."))) {
            res.sendFile(aiModelPath + name + "/" + file);
        } else {
            res.sendStatus(400);
        }
    } else {
        res.sendStatus(401);
    }
});

router.post("/models/:name/train", (req, res) => {
    if (req.session!.user) {
        let name = decodeURI(req.params.name as string);

        if(!(name.startsWith(".") || name.includes(".."))) {
            console.log("Patch model: " + name);
            trainNewModel(name).then(() => res.sendStatus(204), err => res.sendStatus(500));
        } else {
            res.sendStatus(400);
        }
    } else {
        res.sendStatus(401);
    }
});

router.put("/models/:name/classify", (req, res) => {
    if (req.session!.user && req.body.file && req.body.class) {
        let fid: number = Number(req.body.file);
        let className: string = req.body.class as string;
        if (isNaN(fid)) {
            res.sendStatus(400);
            return;
        }
        (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM documentLabels WHERE fid = ?", [fid], (err, result) => {
            if(err || result.length === 0) {
                (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("INSERT INTO documentLabels (fid, label) VALUES (?, ?)", [fid, className], (err, result) => {
                    res.sendStatus(204);
                });
            } else {
                (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("UPDATE documentLabels SET label = ? WHERE fid = ?", [className, fid], (err, result) => {
                    res.sendStatus(204);
                });
            }
        });
    } else {
        res.sendStatus(401);
    }
});

router.get("/models/:name/classes", (req, res) => {
    if (req.session!.user) {
        let name = decodeURI(req.params.name as string);
        getClasses().then(labels => {
            let ret: any[] = [];
            labels.forEach((val, key, map) => {
                ret.push({
                    key: val,
                    class: key
                });
            });
            res.json(ret);
        }, err => {
            console.log(err);
            res.sendStatus(500);
        });
    } else {
        res.sendStatus(401);
    }
});

export {
    router
};