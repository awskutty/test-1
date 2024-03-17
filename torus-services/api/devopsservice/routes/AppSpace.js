var Path = require("path");
var express = require("express");
var FileSystem = require("fs");
var reqRedis = require('redis');
var router = express.Router();
var async = require('async')
var helper = require("../helper")
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var redisHelper = require("../helper_files/redis")
var solrHelper = require("../helper_files/solr")
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
async function AppSpaceConfiguration(ClientParams) {
    var BuildPath = Path.join(__dirname, "../", "Build-Items");
    if (!FileSystem.existsSync(BuildPath)) {
        return { "DISABLE_EXECUTE_BTN": "Y" }
    }
    if (FileSystem.existsSync(BuildPath)) {
        console.log("Build Path : " + BuildPath);
        var BackendPath = Path.join(BuildPath, "backend");
        var DeployDetail = await helper.GetAppInfoFromJson(BackendPath);
        await redisHelper.CreateDefaultRedisEntries(DeployDetail);
        return "SUCCESS";
    }
}

/* Get deployment detail from  infojson and app_info json file and find deployment first time or not*/
async function GetDeployDetails() {
    var BuildPath = Path.join(__dirname, "../", "Build-Items");
    console.log(BuildPath);
    if (!FileSystem.existsSync(BuildPath)) {
        return { "STATUS": "FAILURE", "DISABLE_EXECUTE_BTN": "Y", "ERR_MESSAGE": "No Release found." }
    }
    if (FileSystem.existsSync(BuildPath)) {
        var FirstTime = "Y";
        var DeployScriptItems = []
        var BackendPath = Path.join(BuildPath, "backend");
        var DeployDetail = await helper.GetAppInfoFromJson(BackendPath);
        var BuildInfoFile = Path.join(BuildPath, "buildinfo.json");
        if (FileSystem.existsSync(BuildInfoFile)) {
            var strJson = FileSystem.readFileSync(BuildInfoFile).toString();
            var BuildInfo = JSON.parse(strJson);
            DeployDetail.BUILD_ID = BuildInfo.BUILD_ID;
            DeployDetail.Schema = {};
            var DBHelper = DeployDetail.DBHelper;
            var radisConnection = await redisHelper.GetRedisConnection();
            var devopsEnvKey = await redisHelper.GetRedisData(radisConnection, "DEVOPS_ENVIRONMENT");
            if (devopsEnvKey) {
                var DeployInfo = await DBHelper.GetDeployDetails(DeployDetail);
                FirstTime = DeployInfo.FirstTime;
                if (FirstTime == "N") {
                    DeployScriptItems = await DBHelper.GetDeployScriptItems(DeployDetail);
                    if (DeployInfo.DeployInfo.deploy_id == DeployDetail.BUILD_ID && DeployScriptItems.length == 0) {
                        return { "STATUS": "FAILURE", "DISABLE_EXECUTE_BTN": "Y", "ERR_MESSAGE": "No Release found." }
                    }
                }
            }
        }
        var DeployObj = {
            "STATUS": "SUCCESS",
            "DB_NAME": DeployDetail.DB_NAME,
            "APPLICATION_DESCRIPTION": (DeployDetail.APPLICATION_DESCRIPTION) ? DeployDetail.APPLICATION_DESCRIPTION : "",
            "FIRST_TIME": FirstTime,
            "FAILED_QUERIES": DeployScriptItems,
            "LIST_COUNT": DeployScriptItems.length,
            "RELEASE_ID": DeployDetail.BUILD_ID,
            "DISABLE_EXECUTE_BTN": "N"
        }
        return DeployObj;
    }
}

async function RunScripts(ClientParams) {
    console.log("RunScripts  function called");
    var BuildPath = Path.join(__dirname, "../", "Build-Items");
    if (!FileSystem.existsSync(BuildPath)) {
        return { "DISABLE_EXECUTE_BTN": "Y" }
    }
    if (FileSystem.existsSync(BuildPath)) {
        var CustomLogFolder = Path.join(__dirname, "../", "log")
        console.log("Build Path : " + BuildPath);
        helper.deleteFolderRecursive(CustomLogFolder);
        var FirstTime = "Y";
        var BackendPath = Path.join(BuildPath, "backend");
        var DeployDetail = await helper.GetAppInfoFromJson(BackendPath);
        if (ClientParams.DB_NAME) {
            DeployDetail.DB_NAME = ClientParams.DB_NAME;
        }
        DeployDetail.CLEANUP_TABLES = false;
        var isrollbackfile = Path.join(BuildPath, "is_rollback.txt");
        if (FileSystem.existsSync(isrollbackfile)) {
            DeployDetail.CLEANUP_TABLES = true;
        }
        /* Get build info json */
        var BuildInfoFile = Path.join(BuildPath, "buildinfo.json");
        if (FileSystem.existsSync(BuildInfoFile)) {
            var strJson = FileSystem.readFileSync(BuildInfoFile).toString();
            var BuildInfo = JSON.parse(strJson);
            DeployDetail.BUILD_ID = BuildInfo.BUILD_ID;
            DeployDetail.FunctionName = BuildInfo.MODE;
            ClientParams.BUILD_ID = DeployDetail.BUILD_ID;
            if (BuildInfo.IS_ROLLBACK == "Y") {
                DeployDetail.CLEANUP_TABLES = true;
            }
        }
        if (process.env.username) {
            ClientParams.USER_NAME = process.env.username;
        }
        var DBHelper = DeployDetail.DBHelper;
        if (DBHelper == undefined) {
            return { "DISABLE_EXECUTE_BTN": "Y" }
        }
        ClientParams.CurrentDateTime = DeployDetail.CurrentDateTime = reqDateFormatter.GetCurrentDate(ClientParams.headers);
        if (DeployDetail.FunctionName == "DoRelease") {
            await DBHelper.CheckDeployDetailStatus(DeployDetail);
        }
        DeployDetail.LOGIN_NAME = ClientParams.USER_NAME || "TORUS_ADMIN";
        DeployDetail.BUILD_ID = ClientParams.BUILD_ID || "0";
        DeployDetail.Schema = {};
        DeployDetail.FailedQueries = {};
        DeployDetail.BackendPath = BackendPath;
        DeployDetail.NodeIDEPath = Path.join(DeployDetail.BackendPath, "nodejs-ide");
        DeployDetail.DatabaseAppPath = Path.join(BuildPath, "db", "app", "auto");
        DeployDetail.DatabaseFxPath = Path.join(BuildPath, "db", "fx", "auto");
        DeployDetail.OverwriteFilePath = Path.join(BuildPath, "db", "master");
        console.log("DB_TYPE : " + DeployDetail.DB_TYPE);

        FirstTime = (DeployDetail.FunctionName == "CreateAppSpace") ? "Y" : "N";

        console.log("FirstTime : " + FirstTime);
        if (DeployDetail.FunctionName == "CreateAppSpace") {
            await redisHelper.CreateDefaultRedisEntries(DeployDetail);
        }
        console.log("Process : " + DeployDetail.FunctionName);
        if (DeployDetail.FunctionName == "CreateAppSpace") {
            await DBHelper.CreateSchema(DeployDetail);
            await DBHelper.CreateDefaultEntries(DeployDetail);
            if (DeployDetail.APP_CODE && DeployDetail.APPLICATION_DESCRIPTION && DeployDetail.APPLICATION_TYPE) {
                await DBHelper.CreateAppInfoEnries(DeployDetail);
            }
            var radisConnection = await redisHelper.GetRedisConnection();
            var obj = { "CREATED": "Y", "DB_NAME": DeployDetail.DB_NAME }
            await redisHelper.SetRedisData(radisConnection, { "key": "DEVOPS_ENVIRONMENT", "value": obj });
        } else {
            var AppCount = await DBHelper.CheckApplication(DeployDetail);
            if (AppCount == 0) {
                await DBHelper.CreateAppInfoEnries(DeployDetail);
            }
            await DBHelper.UpdateAppRoles(DeployDetail);
            await DBHelper.ExecuteFileQuery(DeployDetail, DeployDetail.DatabaseFxPath, "ddl.sql");
            await DBHelper.ExecuteFileQuery(DeployDetail, DeployDetail.DatabaseFxPath, "dml.sql");
            await DBHelper.ExecuteFileQuery(DeployDetail, DeployDetail.DatabaseFxPath, "dml.json")
        }
        await DBHelper.ExecuteFileQuery(DeployDetail, DeployDetail.DatabaseAppPath, "ddl_scripts.json");
        await DBHelper.ExecuteFileQuery(DeployDetail, DeployDetail.DatabaseAppPath, "dml_scripts.json");
        await DBHelper.ExecuteFileQuery(DeployDetail, DeployDetail.OverwriteFilePath, "masterdata.sql");
        await DBHelper.ExecuteFileQuery(DeployDetail, DeployDetail.BackendPath, "language_dictionary_json.json");
        await DBHelper.ExecuteFileQuery(DeployDetail, DeployDetail.BackendPath, "language_dictionary_source.json");
        await DBHelper.ExecuteIDEProjects(DeployDetail, DeployDetail.NodeIDEPath, "sql_project");
        await solrHelper.CreateSolrEntries(DeployDetail);
        var result = await DBHelper.HandleFailedQueries(DeployDetail);
        console.log("Process Status : " + result);
        var returnobj = {}
        if (result == "SUCCESS_WITH_ERRORS") {
            var DeployScriptItems = await DBHelper.GetDeployScriptItems(DeployDetail)
            returnobj = { "PROCESS_STATUS": result, "FAILED_QUERIES": DeployScriptItems, "LIST_COUNT": DeployScriptItems.length };
        } else {
            returnobj = { "PROCESS_STATUS": result };
        }
        return returnobj;
    }
}

async function FailedQueryAction(ClientParams) {
    console.log("FailedQueryAction function called");
    var BuildPath = Path.join(__dirname, "../", "Build-Items");
    if (!FileSystem.existsSync(BuildPath)) {
        return { "DISABLE_EXECUTE_BTN": "Y" }
    }
    if (FileSystem.existsSync(BuildPath)) {
        var FailedQueryResult = false;
        console.log("Build Path : " + BuildPath);
        var BackendPath = Path.join(BuildPath, "backend");
        var DeployDetail = await helper.GetAppInfoFromJson(BackendPath);
        for (var i in ClientParams) {
            DeployDetail[i] = ClientParams[i];
        }
        var DBHelper = DeployDetail.DBHelper;
        var DeployScriptItems = [];
        if (DeployDetail.EXECUTE_TYPE == "DELETE") {
            var ids = DeployDetail.EXECUTE_IDS;
            for (var i = 0; i < ids.length; i++) {
                var QueryObj = {
                    "EXECUTE_ID": ids[i]
                };
                await DBHelper.QueryAction(DeployDetail, QueryObj, DeployDetail.EXECUTE_TYPE);
            }
        } else if (DeployDetail.EXECUTE_TYPE == "UPDATE" || DeployDetail.EXECUTE_TYPE == "RETRY") {
            var QueryObj = {};
            if (DeployDetail.EXECUTE_TYPE == "UPDATE") {
                QueryObj = {
                    "EXECUTE_ID": DeployDetail.EXECUTE_ID,
                    "UPDATE_COLUMN": DeployDetail.UPDATE_COLUMN
                };
            } else if (DeployDetail.EXECUTE_TYPE == "RETRY") {
                QueryObj = {
                    "EXECUTE_IDS": DeployDetail.EXECUTE_IDS
                };
            }
            FailedQueryResult = await DBHelper.QueryAction(DeployDetail, QueryObj, DeployDetail.EXECUTE_TYPE);
        }
        DeployScriptItems = await DBHelper.GetDeployScriptItems(DeployDetail);
        return { "FAILED_QUERIES": DeployScriptItems, "LIST_COUNT": DeployScriptItems.length, "FAILEDQUERY_RESULT": FailedQueryResult };
    }
}

async function signin(ClientParams) {
    console.log("signin  function called");
    var BuildPath = Path.join(__dirname, "../", "Build-Items");
    var LoginInfo = {};
    if (!FileSystem.existsSync(BuildPath)) {
        LoginInfo = helper.CheckUsernamePassword(ClientParams.username, ClientParams.password, process.env.username, process.env.password, ClientParams["salt-session"]);
    }
    if (FileSystem.existsSync(BuildPath)) {
        var BuildInfoFile = Path.join(BuildPath, "buildinfo.json");
        var BackendPath = Path.join(BuildPath, "backend");
        var DeployDetail = await helper.GetAppInfoFromJson(BackendPath);
        DeployDetail["Schema"] = {}
        for (var i in ClientParams) {
            DeployDetail[i] = ClientParams[i];
        }
        if (FileSystem.existsSync(BuildInfoFile)) {
            var strJson = FileSystem.readFileSync(BuildInfoFile).toString();
            var BuildInfo = JSON.parse(strJson);
            console.log(BuildInfo);
            if (BuildInfo.MODE.toLowerCase() == "createappspace") {
                LoginInfo = helper.CheckUsernamePassword(ClientParams.username, ClientParams.password, process.env.username, process.env.password, ClientParams["salt-session"]);
            }
            else if (BuildInfo.MODE.toLowerCase() == "dorelease") {
                var DBHelper = DeployDetail.DBHelper;
                var AppCount = await DBHelper.CheckApplication(DeployDetail);
                if (AppCount == 0) {
                    LoginInfo = helper.CheckUsernamePassword(ClientParams.username, ClientParams.password, process.env.username, process.env.password, ClientParams["salt-session"]);
                } else {
                    LoginInfo = await DBHelper.Signin(DeployDetail);
                }
            }
        }
    }
    console.log("signin function ended");
    return LoginInfo;
}

async function Redisconfiginsert(ClientParams) {
    console.log("signin  redis config insert started");
    delete ClientParams["salt-session"]
    if (ClientParams) {
        var insertdata = ClientParams
        try {
            for await (const data of insertdata) {
                reqRedisInstance.GetRedisConnectionwithIndex(data.db, async function (err, redisConn) {
                    var redisEntry = data.value
                    await redisConn.set(data.key, redisEntry);
                })
            }
            return ({ STATUS: "SUCCESS" })
        } catch (error) {
            console.log(error)
        }

    } else {
        console.log('Request is empty')
    }
}
var exportFunctions = {
    AppSpaceConfiguration: AppSpaceConfiguration,
    GetDeployDetails: GetDeployDetails,
    RunScripts: RunScripts,
    FailedQueryAction: FailedQueryAction,
    signin: signin,
    Redisconfiginsert: Redisconfiginsert
}


const GetRedisConnection = function (dbindex) {
    return new Promise((resolve, reject) => {
        reqRedisInstance.GetRedisConnectionwithIndex(dbindex, function (error, clientR) {
            if (error) {
                reject(error.toString());
            }
            else {
                resolve(clientR)
            }
        });
    })

}


function PreparePostData(req) {
    return new Promise(function (resolve, reject) {
        var contentType = req.headers["content-type"];
        if (contentType && contentType.indexOf("multipart/form-data") > -1) {
            var form = new multiparty.Form();
            form.parse(req, function (err, fields, files) {
                if (err) {
                    reject(err);
                }
                var ClientParams = {};
                Object.keys(fields).forEach(function (name) {
                    if (ClientParams[name] == undefined) {
                        if (Array.isArray(fields[name])) {
                            ClientParams[name] = fields[name][0];
                        }
                        else {
                            ClientParams[name] = fields[name];
                        }
                    }
                });
                resolve({ params: ClientParams, files: files });
            });
        }
        else {
            var ClientParams = req.body;
            if (req.headers["salt-session"]) {
                ClientParams["salt-session"] = req.headers["salt-session"];
            }
            resolve({ params: ClientParams, files: null });
        }
    });
};

async function processRoute(req, res) {
    try {
        LastRequest = req;
        console.log("action :" + req.params.action);
        var action = exportFunctions[req.params.action];
        if (!action && req.url.indexOf("GetDeployDetails") > -1) {
            action = exportFunctions["GetDeployDetails"]
        } else if (!action && req.url.indexOf("Redisconfiginsert") > -1) {
            action = exportFunctions["Redisconfiginsert"]
        }
        if (typeof action != "function") {
            res.end("Invalid url path : " + req.url);
            return;
        }
        if (req.path != "/signin") {
            if (!req.headers["authorization"]) {
                throw new Error("No bearer token.");

            } else {
                var JWT_token = req.headers["authorization"].split("Bearer ")[1];
                var result = await helper.JwtVerify(JWT_token, req.headers["salt-session"]);
                if (result.STATUS == "FAILURE") {
                    throw new Error(result.DATA);
                }

            }
        }

        var ParsedDataResult = {
            params: req.query,
            files: null
        };
        if (req.method != "GET") {
            ParsedDataResult = await PreparePostData(req);
        }
        var objLogInfo = null;
        var ActionResult = await action.apply(null, [ParsedDataResult.params, ParsedDataResult.files, objLogInfo])
        var Responsebody = {
            url: req.url,
            method: req.method,
            responseHasError: false,
            errorMessage: "",
            data: ActionResult
        };
        console.log("Response code 200");
        res.status(200).send(Responsebody);
        //return reqInstanceHelper.SendResponse('DevopsService', res, Responsebody, {}, "", "", null, "SUCCESS", null);
    } catch (err) {
        var ErrorMessage = err.toString();
        console.log(ErrorMessage);
        var Responsebody = {
            url: req.url,
            method: req.method,
            responseHasError: true,
            errorMessage: ErrorMessage.toString(),
            data: null
        };
        console.log("Response code 500");
        res.status(500).send(Responsebody);
        //return reqInstanceHelper.SendResponse('DevopsService', res, Responsebody, {}, "errcode", ErrorMessage, err, "FAILURE", null);
    };
};

router.post("/:action", processRoute);
router.get("/GetDeployDetails", processRoute);
router.post("/Redisconfiginsert", processRoute);
router.get('/ping', function (req, res) {
    res.send("SUCCESS")

});

module.exports = router;