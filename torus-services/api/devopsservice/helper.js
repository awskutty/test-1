var Path = require("path");
var dateExtra = require('dateformat');
var FileSystem = require("fs");
var request = require("request");
var jwt = require('jsonwebtoken');
var reqEncHelper = require('../../../torus-references/common/crypto/EncryptionInstance');
var redisHelper = require("./helper_files/redis");

var StringFormat = function () {
    if (!arguments.length)
        return "";
    var str = arguments[0] || "";
    str = str.toString();
    var args = typeof arguments[0],
        args = (("string" == args) ? arguments : arguments[0]);
    [].splice.call(args, 0, 1);
    for (var arg in args)
        str = str.replace(RegExp("\\{" + arg + "\\}", "gi"), args[arg]);
    str = str.replace(RegExp("\\{\\{", "gi"), "{");
    str = str.replace(RegExp("\\}\\}", "gi"), "}");
    return str;
};

var RegExescape = function (text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

var StringReplaceAll = function (pStr, pWord, pReplaceStr) {
    pStr = pStr.replace(RegExp(RegExescape(pWord), "gi"), pReplaceStr);
    return pStr;
};



var ParseJson = function (pStr) {
    var JsonData = null;
    try {
        if (typeof pStr == "object") {
            JsonData = pStr;
        }
        else {
            JsonData = JSON.parse(pStr || "");
        }
    }
    catch (e) {
        JsonData = null;
    }
    return JsonData;
};

var ParseQryJson = function (pStr) {
    var JsonData = null;
    try {
        if (typeof pStr == "object") {
            JsonData = pStr;
        }
        else {

            pStr = pStr.replace(RegExp("\r", "gi"), " ");
            pStr = pStr.replace(RegExp("\n", "gi"), " ");
            pStr = pStr.replace(RegExp("\t", "gi"), " ");
            pStr = pStr.replace(RegExp("$SQ$", "gi"), "''");
            pStr = pStr.replace(RegExp("$SQ$", "gi"), "'");
            pStr = pStr.replace(RegExp("$DQ$", "gi"), '""');

            JsonData = JSON.parse(pStr || "");
        }
    }
    catch (e) {
        JsonData = null;
    }
    return JsonData;
};

function QueryTrim(pStr) {
    pStr = pStr.replace(RegExp("\r", "gi"), " ");
    pStr = pStr.replace(RegExp("\n", "gi"), " ");
    pStr = pStr.replace(RegExp("\t", "gi"), " ");
    pStr = pStr.replace(RegExp("$SQ$", "gi"), "''");
    pStr = pStr.replace(RegExp("$SQ$", "gi"), "'");
    pStr = pStr.replace(RegExp("$DQ$", "gi"), '""');
    pStr = pStr.replace(RegExp("@SPL@", "gi"), "");
    pStr = pStr.replace(RegExp('\"', "gi"), '"');
    return pStr;
}

function convertDBRecordsToQuery(tableInfo, DepParams, keyspace) {
    return new Promise((resolve, reject) => {
        var insertQueries = [];
        for (var t = 0; t < tableInfo.length; t++) {
            var tableName = tableInfo[t].table_name;
            var propertyName = tableInfo[t].property_name;
            var keyword = tableInfo[t].keyword;
            if (DepParams[propertyName]) {
                for (var st = 0; st < DepParams[propertyName].length; st++) {
                    var STData = DepParams[propertyName][st];
                    var recordKeys = Object.keys(STData);
                    if (recordKeys.length > 0) {
                        var qryObj = {
                            query: `insert into ${tableName.toLowerCase()} (#KEYS#) values (#VALUES#)`,
                            params: []
                        };
                        var qryKeys = "", qryValues = "";
                        for (var key of recordKeys) {
                            if (key.toLowerCase() == keyword) {
                                qryKeys += `"${keyword}", `;
                            } else {
                                qryKeys += key.toLowerCase() + ", ";
                            }
                            qryValues += "?, ";
                            if (key == "CREATED_DATE" || key == "MODIFIED_DATE") {
                                qryObj.params.push(new Date());
                            } else if (key == "START_ACTIVE_DATE" || key == "END_ACTIVE_DATE") {
                                qryObj.params.push(null);
                            } else if (key == "VERSION_NO" && STData[key] == "") {
                                qryObj.params.push(0);
                            } else {
                                if (typeof STData[key] == "object") {
                                    STData[key] = JSON.stringify(STData[key]);
                                }
                                qryObj.params.push(STData[key]);
                            }
                        }
                        qryKeys = qryKeys.slice(0, -2);
                        qryValues = qryValues.slice(0, -2);
                        qryObj.query = qryObj.query.replace('#KEYS#', qryKeys);
                        qryObj.query = qryObj.query.replace('#VALUES#', qryValues);
                        insertQueries.push(qryObj);
                    }
                }
            }
        }
        resolve(insertQueries);
    });

}

var GetDateTime = function (dateFormat) {
    var CurrentDateTime = dateExtra(new Date(), dateFormat);
    CurrentDateTime = StringReplaceAll(CurrentDateTime, ".", "");
    CurrentDateTime = CurrentDateTime.toUpperCase();
    return CurrentDateTime;
};

function HttpRequest(pUri, pMethod, pPostData, pContentType, pHeaders, pTimeOut) {
    return new Promise((resolve, reject) => {
        var TIMEOUT_MAX = 2147483647;
        var isJson = false;
        if (pContentType) {
            isJson = pContentType.indexOf("application/json") > -1 ? true : false;
        }
        var headers = [{ name: 'content-type', value: pContentType }];
        if (pHeaders) {
            pHeaders.forEach(function (header) {
                headers.push(header);
            });
        }
        var req = request({
            uri: pUri.toString(),
            method: pMethod.toString().toUpperCase(),
            body: pPostData,
            json: isJson,
            timeout: pTimeOut ? pTimeOut : TIMEOUT_MAX,
            headers: headers
        }, function (err, httpResponse, body) {
            if (err) {
                var Message = "Error occurs while calling request - " + pUri;
                Message = Message + "\r\n" + err.toString();
                reject(Message);
                return;
            }
            resolve(body);
        });
    });
};

function getDirectories(srcpath) {
    return FileSystem.readdirSync(srcpath).filter(function (file) {
        return FileSystem.statSync(Path.join(srcpath, file)).isDirectory();
    });
};

async function GetAppInfoFromJson(BackendPath) {
    return new Promise((resolve, reject) => {
        var BuildAppParams = {};
        /***** Read infojson file****** */
        var infoJson = Path.join(BackendPath, 'infojson.json');
        var DeployParams = null;
        if (FileSystem.existsSync(infoJson)) {
            var strparams = FileSystem.readFileSync(infoJson).toString();
            DeployParams = ParseJson(strparams);
            for (var i in DeployParams) {
                BuildAppParams[i] = DeployParams[i];
                if (BuildAppParams[i] == "" && (i == "CLIENT_ID" || i == "APP_ID" || i == "TENANT_ID")) {
                    BuildAppParams[i] = "0";
                }
            }
        } else {
            throw new Error("missing infojson params");
        }

        /***** Read app_info json file****** */
        var AppinfoJson = Path.join(BackendPath, 'app_info.json');
        if (FileSystem.existsSync(AppinfoJson)) {
            var strparams = FileSystem.readFileSync(AppinfoJson).toString();
            AppInfoParams = ParseJson(strparams);
            for (var i in AppInfoParams) {
                if (typeof BuildAppParams[i] == "undefined") {
                    if (i == "APP_ROLES" || i == "SYSTEM_TYPES" || i == "TENANT_SYSTEM_TYPES" || i == "SYSTEM_TYPE_APP_ROLES") {
                        BuildAppParams[i] = JSON.parse(AppInfoParams[i]);
                    }
                    else {
                        BuildAppParams[i] = AppInfoParams[i];
                    }
                }
            }
        } else {
            throw new Error("missing app info params");
        }
        if (BuildAppParams.DB_TYPE == "DEFAULT") {
            BuildAppParams.DB_TYPE = "postgres";
        }
        if (BuildAppParams.DB_TYPE.toLowerCase() == "postgres") {
            BuildAppParams.DBHelper = require("./helper_files/postgres");
        } else if (BuildAppParams.DB_TYPE.toLowerCase() == "oracle") {
            BuildAppParams.DBHelper = require("./helper_files/oracle");
        }
        var ClientId = BuildAppParams.CLIENT_ID;
        var AppId = BuildAppParams.APP_ID;
        var TenantId = BuildAppParams.TENANT_ID;
        var EnvCode = BuildAppParams.ENV_CODE;
        BuildAppParams.DB_NAME = StringFormat("clt{0}_env{1}_app{2}_tnt{3}_tran", ClientId.toString(), EnvCode.toString().toLowerCase(), AppId, TenantId);
        if (BuildAppParams.DB_TYPE == "ORACLE") {
            BuildAppParams.DB_NAME = StringFormat("clt{0}_app{1}", ClientId.toString(), AppId);
        }
        BuildAppParams.headers = {
            routingkey: 'CLT-' + ClientId + '~APP-' + AppId + '~TNT-' + TenantId + '~ENV-' + EnvCode
        };
        redisHelper.GetRedisConnection().then((radisConnection) => {
            redisHelper.GetRedisData(radisConnection, "DEVOPS_ENVIRONMENT").then((devopsEnvKey) => {
                if (devopsEnvKey) {
                    var redisData = JSON.parse(devopsEnvKey);
                    if (redisData.DB_NAME) {
                        BuildAppParams.DB_NAME = redisData.DB_NAME;
                    }

                    resolve(BuildAppParams);
                } else {
                    resolve(BuildAppParams);
                }
            });
        });


    });
}

var deleteFolderRecursive = function (path) {
    if (FileSystem.existsSync(path)) {
        FileSystem.readdirSync(path).forEach(function (file) {
            var curPath = path + "/" + file;
            if (FileSystem.statSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                FileSystem.unlinkSync(curPath);
            }
        });
        FileSystem.rmdirSync(path);
    }
};

function CheckUsernamePassword(ClientUserName, ClientPassword, username, password, saltvalue) {
    var loginobj = {};
    if (ClientUserName.toLowerCase() == username.toLowerCase()) {
        var encryptedPwd = reqEncHelper.passwordHash256Withsalt(password, saltvalue);
        if (encryptedPwd == ClientPassword) {
            loginobj.STATUS = "SUCCESS";
            loginobj.PROCESS_STATUS = "Signin successfully.";
            loginobj.isAuthenticated = true;
        } else {
            loginobj.STATUS = "ERROR";
            loginobj.PROCESS_STATUS = "Password does not match.";
            loginobj.isAuthenticated = false;
        }
    } else {
        loginobj.STATUS = "ERROR";
        loginobj.PROCESS_STATUS = "User does not exist.";
        loginobj.isAuthenticated = false;
    }
    loginobj.DISABLE_EXECUTE_BTN = "Y";
    if (loginobj.STATUS == "SUCCESS") {
        var token = jwt.sign({ UserName: ClientUserName }, saltvalue, {});
        loginobj.token = "Bearer " + token;
    }
    return loginobj;
}

function JwtVerify(JWT_token, saltvalue) {
    return new Promise((resolve, reject) => {
        jwt.verify(JWT_token, saltvalue, function (err, decoded) {
            if (err) {
                resolve({ "STATUS": "FAILURE", "DATA": "JWT does not match" });
            }
            else {
                resolve({ "STATUS": "SUCCESS", "DATA": decoded });
            }
        });
    });
}

module.exports = {
    StringFormat: StringFormat,
    StringReplaceAll: StringReplaceAll,
    ParseJson: ParseJson,
    ParseQryJson, ParseQryJson,
    GetDateTime: GetDateTime,
    HttpRequest: HttpRequest,
    GetDirectories: getDirectories,
    convertDBRecordsToQuery: convertDBRecordsToQuery,
    QueryTrim: QueryTrim,
    GetAppInfoFromJson: GetAppInfoFromJson,
    deleteFolderRecursive: deleteFolderRecursive,
    CheckUsernamePassword: CheckUsernamePassword,
    JwtVerify: JwtVerify
};