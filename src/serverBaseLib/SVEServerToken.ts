import {SVEAccount, SVEGroup, SVEToken, TokenInfo, TokenType} from 'svebaselib';
import mongoose from 'mongoose';
import { SVEServerSystemInfo } from './SVEServerSystemInfo';

const tokenSchema = new mongoose.Schema({
    token: String,
    name: String,
    time: Date,
    type: Number,
    target: Number,
    deviceAgent: String
}, {timestamps: true});
const TokenModel = mongoose.model('Token', tokenSchema);

export class SVEServerToken extends SVEToken {
    public static register(owner: SVEAccount, type: TokenType, target: SVEAccount | SVEGroup, agent: string = ""): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            if (SVEServerSystemInfo.getSystemStatus().tokenSystem) {
                let token = [...Array(30)].map(i=>(~~(Math.random()*36)).toString(36)).join('');
                let t = new TokenModel({
                    token: token,
                    type: Number(type),
                    target: target.getID(),
                    name: target.getName(),
                    deviceAgent: agent
                });
                t.save((err, tk) => {
                    if (err) {
                        console.log("MONGOOSE SAVE ERROR:" + JSON.stringify(err));
                        reject();
                    } else {
                        resolve(token);
                    }
                });
            } else {
                reject();
            }
        });
    }

    public static tokenExists(type: TokenType, token: string, targetID: number): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            let search: any = undefined;
            if (isNaN(targetID)) {
                search = {token: token, type: Number(type)};
            } else {
                search = {token: token, type: Number(type), target: targetID};
            }
            TokenModel.find(search, (err, tokens) => {
                if(err) {
                    console.log("MONGOOSE FIND ERROR:" + JSON.stringify(err));
                    reject();
                } else {
                    resolve(true);
                }
            });
        });
    }

    public static use(type: TokenType, token: string, targetID: number): Promise<TokenInfo> {
        return new Promise<TokenInfo>((resolve, reject) => {
            TokenModel.findOne({token: token, type: Number(type), target: targetID}, (err, tokens) => {
                if(err || tokens == null) {
                    console.log("MONGOOSE USE ERROR:" + JSON.stringify(err));
                    reject();
                } else {
                    resolve(tokens[0] as TokenInfo);
                }
            });
        });
    }

    public static remove(type: TokenType, token: string, targetID: number): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            TokenModel.findOneAndRemove(
                {
                    token: token, 
                    type: Number(type), 
                    target: targetID
                }, 
                {
                    useFindAndModify: false,
                }, 
                (err, tokens) => {
                    if(err) {
                        console.log("MONGOOSE REMOVE ERROR:" + JSON.stringify(err));
                        reject();
                    } else {
                        resolve(true);
                    }
            });
        });
    }

    public static removeByInfo(token: TokenInfo): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            TokenModel.findOneAndRemove(
                { 
                    type: Number(token.type), 
                    target: token.target,
                    deviceAgent: token.deviceAgent,
                }, 
                {
                    useFindAndModify: false,
                }, 
                (err, tokens) => {
                    if(err) {
                        console.log("MONGOOSE REMOVE ERROR:" + JSON.stringify(err));
                        reject();
                    } else {
                        resolve(true);
                    }
            });
        });
    }

    public static getAll(type: TokenType, user: SVEAccount): Promise<TokenInfo[]> {
        return new Promise<TokenInfo[]>((resolve, reject) => {
            TokenModel.find({target: user.getID(), type: Number(type)}, (err, tokens) => {
                if(err) {
                    console.log("MONGOOSE RETRIEVE ERROR:" + JSON.stringify(err));
                    reject();
                } else {
                    let tokenInfos: TokenInfo[] = [];
                    tokens.forEach((t, i, a) =>{
                        tokenInfos.push((t as any) as TokenInfo);
                    });
                    resolve(tokenInfos);
                }
            });
        });
    }
}

export {
    TokenModel
};