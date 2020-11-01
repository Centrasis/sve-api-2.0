import ServerHelper from './serverhelper';
import {SVEServerSystemInfo as SVESystemInfo } from './serverBaseLib/SVEServerSystemInfo';
import {SVEServerData as SVEData } from './serverBaseLib/SVEServerData';
import {BasicUserInitializer, SVEGroup as SVEBaseGroup, SVEData as SVEBaseData, LoginState, SVEProjectType, SessionUserInitializer, SVESystemState, SVEAccount as SVEBaseAccount, SVEDataInitializer, SVEDataVersion, UserRights, QueryResultType, RawQueryResult, GroupInitializer, ProjectInitializer, SVEProjectState, TokenType, BasicUserLoginInfo, SVEDataType} from 'svebaselib';
import {SVEServerAccount as SVEAccount, SVEServerRootAccount} from './serverBaseLib/SVEServerAccount';
import { Request, Response, Router } from "express";
import * as tf from '@tensorflow/tfjs-node';
import * as fs from "fs";
import mysql from 'mysql';
import { basename, dirname } from 'path';
import * as sharp from "sharp";
import * as hasard from 'hasard';
import { ModuleKind } from 'typescript';

var aiModelPath = "/ai/models/";
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
                    filters: 64,
                    strides: 2,
                    kernelSize: [7, 7],
                    activation: 'relu',
                }));
                model.add(tf.layers.maxPooling2d({poolSize: [3, 3], strides: 2}));
                model.add(tf.layers.conv2d({
                    filters: 64,
                    kernelSize: [3, 3],
                    activation: 'relu',
                }));
                model.add(tf.layers.batchNormalization());
                model.add(tf.layers.maxPooling2d({poolSize: [2, 2]}));
                model.add(tf.layers.conv2d({
                    filters: 128,
                    kernelSize: [3, 3],
                    activation: 'relu'
                }));
                model.add(tf.layers.batchNormalization());
                model.add(tf.layers.maxPooling2d({poolSize: [2, 2]}));
                model.add(tf.layers.conv2d({
                    filters: 256,
                    kernelSize: [3, 3],
                    activation: 'relu'
                }));
                model.add(tf.layers.conv2d({
                    filters: 256,
                    kernelSize: [3, 3],
                    activation: 'relu'
                }));
                model.add(tf.layers.conv2d({
                    filters: 512,
                    kernelSize: [3, 3],
                    activation: 'relu'
                }));
                model.add(tf.layers.conv2d({
                    filters: 512,
                    kernelSize: [3, 3],
                    activation: 'relu'
                }));
                model.add(tf.layers.flatten());
                model.add(tf.layers.dropout({
                    rate: 0.5
                }));
                model.add(tf.layers.dense({
                    activation: 'softmax',
                    units: classes.size
                }));
                model.compile({
                    optimizer: new tf.AdamOptimizer(0.0002, 0.5, 0.999),
                    loss: tf.metrics.categoricalCrossentropy,
                    metrics: [
                        tf.metrics.categoricalAccuracy,
                        tf.metrics.meanSquaredError
                    ]
                });
                resolve(model);
            });
        });
    }
}

export function predict(filename: string, model: string, relative: boolean = false): Promise<number> {
    return new Promise<number>((resolve, reject) => {
        if(relative) {
            aiModelPath = dirname(process.argv[1]) + "/models/";
        }

        let mpath = "file://" + aiModelPath + model + "/model.json";
        tf.loadLayersModel(mpath).then(model => {
            img2Tensor(filename).then(tensor => {
                tf.tidy(() => {
                    const eTensor = tf.reshape(tensor, [1, imageSize[0], imageSize[1], 3]); // tensor.expandDims(0).asType('float32').div(256.0);
                    const prediction = model.predict(eTensor) as tf.Tensor1D;
                    console.log("Prediction: " + JSON.stringify(prediction.dataSync()));
                    const maxIdx = prediction.as1D().argMax().dataSync()[0];
                    const max = maxIdx + 1;
                    resolve(max);
                });
            }, err => reject(err));
        }, err => {
            console.log("Error on load model: " + JSON.stringify(err));
            reject();
        });
    });
}

function saveModel(name: string, model: tf.LayersModel) {
    if(!fs.existsSync(aiModelPath + name)) {
        fs.mkdirSync(aiModelPath + name, {recursive: true});
    }

    model.save("file://" + aiModelPath + name);
}

function img2Tensor(filename: string): Promise<tf.Tensor3D> {
    return new Promise<tf.Tensor3D>((resolve, reject) => {
        sharp.default(filename)
        .resize(imageSize[0], imageSize[1], {fit: "fill", kernel: "cubic", height: imageSize[1], width: imageSize[0], withoutEnlargement: false})
        .removeAlpha()
        .toFormat('png')
        .toBuffer({resolveWithObject: true})
        .then(({ data, info }) => {
            const tensor = tf.tidy(() => { return tf.node.decodeImage(Buffer.from(data.buffer), 3) }) as tf.Tensor3D;
            resolve(tensor);
        }).catch(err => reject(err));
    });
}

function img2AugmentedTensor(filename: string): Promise<tf.Tensor3D> {
    return new Promise<tf.Tensor3D>((resolve, reject) => {
        let img = sharp.default(filename)
        .blur((Math.random() < 0.15) ? false : Math.random() * 3.0 + 0.3)
        .greyscale(Math.random() < 0.1)
        .rotate(Math.random() * 180.0 - 90.0, {background: "#000000"})
        .removeAlpha();
        if(Math.random() < 0.2) {
            img = img.modulate({
                hue: Math.round(Math.random() * 270),
                saturation: Math.random() + 1,
                brightness: Math.random() + 1
            });
        }
        img.toFormat('png')
        .toBuffer({resolveWithObject: true})
        .then(({ data, info }) => {
            const tensor = tf.tidy(() => { return tf.image.resizeBilinear(tf.node.decodeImage(Buffer.from(data.buffer), 3), imageSize) }) as tf.Tensor3D;
            resolve(tensor);
        }).catch(err => reject(err));
    });
}

function makeHotEncodingTensor(idx: number, classes: number, scale: number = 1.0): tf.Tensor1D {
    let v: number[] = new Array(classes).fill(0);
    v[idx] = 1.0 * scale;
    return tf.tensor1d(v);
}

function fitDataset(model: tf.LayersModel, labels: Map<string, number>, docData: SVEData[], docLabels: string[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const random_samples = 25;

        let x_train: tf.Tensor3D[] = [];
        let y_train: tf.Tensor1D[] = [];
        let y_validate: tf.Tensor1D[] = [];
        let x_validate: tf.Tensor3D[] = [];

        let augment_out = dirname(process.argv[1]) + "/augmentData/";

        let fit_dataset = () => {
            console.log("Train over: " + x_train.length + " samples");
            console.log("Evaluate over: " + x_validate.length + " samples");

            let xs = tf.data.array(x_train);
            let ys = tf.data.array(y_train);
            const ds = tf.data.zip({xs, ys}).repeat(5).shuffle(Math.round(Math.random() * x_train.length / 2.0 + x_train.length / 2.0), Math.random().toString(36).substring(7)).batch(32, true);

            let xs_valid = tf.data.array(x_validate);
            let ys_valid = tf.data.array(y_validate);
            const ds_valid = tf.data.zip({xs: xs_valid, ys: ys_valid}).repeat(5).shuffle(Math.round(Math.random() * x_validate.length / 2.0 + x_validate.length / 2.0), Math.random().toString(36).substring(7)).batch(20, true);

            model.fitDataset(ds, {epochs: 10, validationData: ds_valid}).then(info => {
                console.log("Training complete! Start evaluation...");
                model.evaluateDataset(ds_valid as tf.data.Dataset<{}>, {batches: undefined}).then(score => {
                    if ((score as any).length === undefined) {
                        (score as tf.Scalar).print();
                    } else {
                        console.log("Loss: ");
                        (score as tf.Scalar[])[0].print();
                        console.log("Accuracy: ");
                        (score as tf.Scalar[])[1].print();
                    }

                    for(let i = 0; i < x_validate.length; i++) {  
                        let pred = model.predict(tf.reshape(x_validate[i], [1, imageSize[0], imageSize[1], 3])/*.expandDims(0).asType('float32').div(256.0)*/) as tf.Tensor;
                        console.log("Truth: ");
                        y_validate[i].print();
                        console.log("Prediction: ", pred.as1D().argMax().dataSync()[0] + 1);
                        pred.print();
                    }
                    resolve();
                });
            }).catch(err => { console.log("fitDataset failed: ", err); reject(err); });
        };

        let generate_validationset = () => {
            console.log("Generate validation data...");
            let validationSize = docData.length;
            for (let i = 0; i < validationSize; i++) {
                img2Tensor(docData[i % docData.length].getLocalPath(SVEDataVersion.Preview)).then(tensor => {
                    x_validate.push(tensor);
                    let lbl = labels.get(docLabels[i % docLabels.length])!;
                    y_validate.push(makeHotEncodingTensor(lbl - 1, labels.size));
                    if(x_validate.length === validationSize) {
                        fit_dataset();
                    }
                });
            }
        }

        let generate_trainset = function() {
            console.log("Generate training data...");
            let trainSize = docData.length * random_samples;
            for (let i = 0; i < trainSize; i++) {
                img2AugmentedTensor(docData[i % docData.length].getLocalPath(SVEDataVersion.Preview)).then(tensor => {
                    x_train.push(tensor);
                    let lbl = labels.get(docLabels[i % docLabels.length])!;
                    //let l = makeHotEncodingTensor(lbl - 1, labels.size, 100 / docLabels.filter(d => d === docLabels[i % docLabels.length]).length);
                    y_train.push(makeHotEncodingTensor(lbl - 1, labels.size));
                    
                    /*tf.node.encodePng(tensor).then(png => {
                        if(!fs.existsSync(augment_out)) {
                            fs.mkdirSync(augment_out, {recursive: true});
                        }
                        fs.writeFileSync(augment_out + Math.random().toString(36).substring(7) + ".png", png);
                    });*/
                    if (x_train.length === trainSize) {
                        generate_validationset();
                    }
                });
            };
        }

        if(fs.existsSync(augment_out)) {
            const rimraf = require("rimraf");
            rimraf(augment_out, generate_trainset);
        } else {
            generate_trainset();
        }    
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

export function trainNewModel(name: string, relative: boolean = false): Promise<void> {
    if(relative) {
        aiModelPath = dirname(process.argv[1]) + "/models/";
    }

    return trainModel(name, true);
}

function trainModel(name: string, forceNew: boolean = false): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        getModel((forceNew) ? "" : name).then(model => {
            model.summary();
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
                            if (!SVESystemInfo.getInstance().sources.sveDataPath!.startsWith("http")) {
                                new SVEData(new SVEServerRootAccount(), Number(element.fid), (data) => {
                                    files.push(data);
                                    file_lbs.push(element.label as string);
                                    if (docLbls.length === files.length) {
                                        console.log("Ready to fit data..");
                                        fitDataset(model, labels, files, file_lbs).then(() => {saveModel(name, model); resolve();}).catch(err => console.log("Error on fit: " + JSON.stringify(err)));
                                    }
                                });
                            } else {
                                let filesList = fs.readdirSync(dirname(process.argv[1]) + "/train_data");
                                (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT path FROM files WHERE id = ?", [Number(element.fid)], (err, fileRes) => {
                                    if(err || fileRes.length === 0) {
                                        console.log("Error on fetch files path: " + JSON.stringify(err));
                                        return;
                                    }
                                    let path = {filePath: dirname(process.argv[1]) + "/train_data/" + filesList.filter(f => basename(f) === basename(fileRes[0].path as string))[0], thumbnailPath: dirname(process.argv[1]) + "/train_data/" + filesList.filter(f => basename(f) === basename(fileRes[0].path as string))[0]};
                                    new SVEData(new SVEServerRootAccount(), {
                                        id: Number(element.fid),
                                        type: SVEData.getTypeFrom(fileRes[0].path as string),
                                        path: path
                                    }, (data) => {
                                        files.push(data);
                                        file_lbs.push(element.label as string);
                                        if (docLbls.length === files.length) {
                                            console.log("Ready to fit data remote..");
                                            fitDataset(model, labels, files, file_lbs).then(() => {saveModel(name, model); resolve();}).catch(err => console.log("Error on fit: " + JSON.stringify(err)));
                                        }
                                    });
                                });
                            }
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

        if(!(file.startsWith(".") || file.includes("..") || name.startsWith(".") || name.includes(".."))) {
            res.sendFile(aiModelPath + name + "/" + file);
        } else {
            res.sendStatus(400);
        }
    } else {
        res.sendStatus(401);
    }
});

/*
router.post("/model/:name/train", (req, res) => {
    if (req.session!.user) {
        let name = decodeURI(req.params.name as string);

        if(!(name.startsWith(".") || name.includes(".."))) {
            console.log("Patch model: " + name);
            trainModel(name).then(() => res.sendStatus(204), err => res.sendStatus(500));
        } else {
            res.sendStatus(400);
        }
    } else {
        res.sendStatus(401);
    }
});

router.post("/model/:name/retrain", (req, res) => {
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
*/

router.put("/model/:name/classify", (req, res) => {
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

router.get("/model/:name/classification/:fid([\\+\\-]?\\d+)", (req, res) => {
    if (req.session!.user) {
        let fid: number = Number(req.params.fid);
        (SVESystemInfo.getInstance().sources.persistentDatabase! as mysql.Connection).query("SELECT * FROM documentLabels WHERE fid = ?", [fid], (err, result) => {
            if(err || result.length === 0) {
                res.json({
                    success: false
                });
            } else {
                res.json({
                    success: true,
                    class: result[0].label as string
                });
            }
        });
    } else {
        res.sendStatus(401);
    }
});

router.get("/model/:name/classes", (req, res) => {
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