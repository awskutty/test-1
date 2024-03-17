/**
 * Created by Mariappan on 8/31/2016.
 */

// Require dependencies

var modPath = '../../../../node_modules/';
var refHelperPath = '../../../../torus-references/helper/';
var multiparty = require(modPath + 'multiparty');
var reqExpress = require(modPath + 'express');
var extract = require(modPath + 'simple-archiver').extract;
var encHelper = require('../../../../torus-references/common/crypto/EncryptionInstance');
var bodyParser = require(modPath + "body-parser");
var SyncRequest = require(modPath + 'sync-request');
var router = reqExpress.Router();
var path = require('path');
var FileSystem = require('fs');
var co = require(modPath + 'co');
var JLinq = require(modPath + "node-linq").LINQ;
var cassandra = require(modPath + "cassandra-driver");
var request = require('request');
var reqKnex = require(modPath + "knex");
var reqRptHlpr = require('./report/ReportHelper');
var reqRptIns = require('../../../../torus-references/instance/ReportInstance');
var reqHashtable = require(modPath + 'jshashtable');
var reqAsync = require(modPath + 'async');
var reqFileHlpr = require('./report/FileHelper');
var tranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');;
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
var mDepCas = ''
var mTranDB = ''
var arrRptInfo = []
var Service_Mode = ''
var PostgresKey = ''
var tempPath = path.join(__dirname, "../temp/");
var tempDeployPath = path.join(tempPath, "/deployment/");

router.post('/:action', function (req, res) {
    co(function* () {
        res.socket.setTimeout(0);
        var action = PostRoutes[req.params.action];
        if (typeof action != "function") {
            res.end("Invalid request : " + req.url);
            return;
        }
        var Genaction = co.wrap(action);
        var ParsedDataResult = yield PreparePostData(req);
        var objLogInfo = null;
        var ActionResult = yield Genaction.apply(null, [ParsedDataResult.params, ParsedDataResult.files, objLogInfo]);
        var Responsebody = {
            url: req.url,
            method: req.method,
            responseHasError: false,
            errorMessage: "",
            data: ActionResult
        };
        res.status("200");
        res.write(JSON.stringify(Responsebody));
        res.end();
    }).catch(function (err) {
        var ErrorMessage = err.toString()
        var Responsebody = {
            url: req.url,
            method: req.method,
            responseHasError: true,
            errorMessage: ErrorMessage.toString(),
            data: null
        };
        res.status("500");
        res.write(JSON.stringify(Responsebody));
        res.end();
    });
});

function* ClientEnvironmentDeploy(ClientParams, Files) {
    var FileName = ClientParams["IMPORT_FILENAME"];
    var ImportMethod = ClientParams["HAS_FILE"];
    var ImportFile = null;
    if (typeof Files["IMPORT_FILE"] != "undefined") {
        ImportFile = Files["IMPORT_FILE"];
    }
    if (ImportMethod == "Y") {
        if (!FileSystem.existsSync(tempPath)) {
            FileSystem.mkdirSync(tempPath);
        }
        deleteFolderRecursive(tempDeployPath);
        FileSystem.mkdirSync(tempDeployPath);
        yield ExtractZipFile(tempDeployPath, ImportFile.data);

        var dllscripts = path.join(tempDeployPath, 'ddl_scripts.json');
        var dmlscripts = path.join(tempDeployPath, 'dml_scripts.json');
        var solrjson = path.join(tempDeployPath, 'solr_json.json');
        var infoJson = path.join(tempDeployPath, 'infojson.json');

        var DeployParams = null;
        if (FileSystem.existsSync(infoJson)) {
            var strparams = FileSystem.readFileSync(infoJson).toString();
            DeployParams = ParseJson(strparams);
        } else {
            throw new Error("missing info params");
        }

        if (!DeployParams) {
            throw new Error("missing info params");
        }

        var objDDLScripts = null;
        if (FileSystem.existsSync(dllscripts)) {
            var strddl = FileSystem.readFileSync(dllscripts, 'utf8').toString();
            objDDLScripts = ParseJson(strddl, true);
        }

        var objDMLScripts = null;
        if (FileSystem.existsSync(dmlscripts)) {
            var strdml = FileSystem.readFileSync(dmlscripts, 'utf8').toString()
            objDMLScripts = ParseJson(strdml, true);
        }

        var objSolrJson = null;
        if (FileSystem.existsSync(solrjson)) {
            var strsolr = FileSystem.readFileSync(solrjson, 'utf8').toString();
            objSolrJson = ParseJson(strsolr, true);
        }

        var ClientId = DeployParams["CLIENT_ID"];
        var AppId = DeployParams["APP_ID"];
        var TenantId = DeployParams["TENANT_ID"];
        var EnvCode = DeployParams["ENV_CODE"];
        var UserId = DeployParams["U_ID"];
        var DeployID = DeployParams["DEPLOY_ID"];
        var TemplateID = DeployParams["TEMPLATE_ID"];
        var Keyspaces = yield PrepareRemoteCassandraSessions(ClientId, AppId, TenantId, EnvCode);
        var objDepCas = Keyspaces["dep_cas"];

        // yield DeployJasperServerComponent({
        //         BATCH_QUERIES: objDMLScripts
        //     })
        yield ExecuteRemoteCassandraQueries(ClientId, AppId, TenantId, EnvCode, TemplateID, objDMLScripts, objDepCas);
        yield PrepareRemoteSolrSchema(ClientId, AppId, TenantId, EnvCode, TemplateID, objSolrJson);
        yield ExecuteRemotePostgresQueries(ClientId, AppId, TenantId, EnvCode, TemplateID, objDDLScripts);
        var DepCasName = objDepCas.keyspace;
        var DepHistoryTable = {
            "query": StringFormat("create table if not exists {0}.deployhistory (app_id text, client_id text, env_code text, cead_id int, created_by text, created_date timestamp, deploy_status text, primary key (app_id, client_id, env_code, cead_id))", DepCasName),
            "params": []
        };
        var insertHisTable = {
            "query": StringFormat("insert into {0}.deployhistory(app_id, client_id, env_code, cead_id, created_by, created_date, deploy_status) values(?, ?, ?, ?, ?, ?, ?)", DepCasName),
            "params": [AppId, ClientId, EnvCode, DeployID, UserId, reqDateFormater.GetTenantCurrentDateTime(req.headers, objLogInfo), "DEPLOYED"]
        };
        yield ExecuteRemoteCassandraQueries(ClientId, AppId, TenantId, EnvCode, TemplateID, [DepHistoryTable, insertHisTable], objDepCas);
    }
    return "SUCCESS";
};

function* GetDeployedHistory(ClientParams) {
    var ClientId = ClientParams["CLIENT_ID"];
    var AppId = ClientParams["APP_ID"];
    var TenantId = ClientParams["TENANT_ID"];
    var EnvCode = ClientParams["ENV_CODE"].toString().toUpperCase();
    var UserId = ClientParams["U_ID"];
    var Keyspaces = yield PrepareRemoteCassandraSessions(ClientId, AppId, TenantId, EnvCode);
    var objDepCas = Keyspaces["dep_cas"];
    var objCltCas = Keyspaces["clt_cas"];

    var strSelectSystem = "select columnfamily_name from system.schema_columnfamilies where keyspace_name = ? and columnfamily_name = ?";
    var strSelectDeploy = "select * from deployhistory where app_id = ? and client_id = ? and env_code = ?"
    var strUserSelect = "select login_name from users where u_id = ? and client_id =? allow filtering"
    var DeployedHistory = [];
    var objTabExist = yield executecassandra(objDepCas, strSelectSystem, [objDepCas.keyspace, "deployhistory"], true);
    if (objTabExist.rowLength > 0) {
        var objDepHis = yield executecassandra(objDepCas, strSelectDeploy, [AppId, ClientId, EnvCode], true);
        for (var iRow = 0; iRow < objDepHis.rowLength; iRow++) {
            var RowInfo = objDepHis.rows[iRow];
            var UserName = "";
            var objUser = yield executecassandra(objCltCas, strUserSelect, [RowInfo.created_by, ClientId], true);
            if (objUser.rowLength > 0 && objUser.rows[0].login_name) {
                UserName = objUser.rows[0].login_name.toString();
            }
            var HisInfo = {
                DEPLOY_ID: RowInfo.cead_id,
                CREATED_BY: UserName,
                CREATED_DATE: RowInfo.created_date,
                DEPLOY_STATUS: RowInfo.deploy_status
            };
            DeployedHistory.push(HisInfo);
        }
    }
    return DeployedHistory;
};

function* ExecuteRemoteCassandraQueries(ClientId, AppId, TenantId, EnvCode, TemplateID, pBatchQueries, objDepCas) {
    if (!pBatchQueries || pBatchQueries.length == 0) {
        return "SUCCESS";
    }
    var lstArptdId = []
    arrRptInfo = []
    var Header = {
        routingkey: 'CLT-' + ClientId + '~APP-' + AppId + '~TNT-' + TenantId + '~ENV-' + EnvCode
    }

    for (var iQry = 0; iQry < pBatchQueries.length; iQry++) {
        var QueryDetail = pBatchQueries[iQry];
        if (QueryDetail.query == "") {
            continue;
        }

        if (QueryDetail.target != undefined && QueryDetail.target.toUpperCase() == "APP_RPT_DEFINITIONS_INFO")
            if (QueryDetail.query.indexOf("delete from ") >= 0) // delete report
            {
                yield _DeleteJasperServer(AppId, Header, QueryDetail.params[1].toString(), objDepCas)
                if (QueryDetail.params.length > 2) {
                    QueryDetail.params.pop('4')
                    QueryDetail.params.pop('3')
                    QueryDetail.params.pop('2')
                }
            } else {
                _AddRptID(lstArptdId, QueryDetail.params[1].toString()) // insert report arptdId
                var strTmp1 = QueryDetail.query.split("values(")
                var strTmp2 = strTmp1[1].split(',')
                var strQryParamLength = strTmp2.length
                if (QueryDetail.params.length > strQryParamLength) {
                    for (i = strQryParamLength; i < QueryDetail.params.length; i++) {
                        QueryDetail.params.pop(strQryParamLength - 1)
                    }
                    //QueryDetail.params.pop('12')
                }
            }
        yield executecassandra(objDepCas, QueryDetail.query, QueryDetail.params, true);
    }


    if (lstArptdId.length > 0) {
        yield PublishJasperServer(AppId, Header, lstArptdId, objDepCas);

    }
    return "SUCCESS";
};

function _AddRptID(pLst, pArptd_id) {
    if (pLst.indexOf(pArptd_id) < 0)
        pLst.push(pArptd_id)
}

function PublishJasperServer(pAppID, pHeader, lstArptdId, depCassandraIns) {
    return new Promise((resolve, reject) => {
        try {
            //publish report to JasperServer
            reqFileHlpr.CreateTempDir(__dirname, 'report', 'Temp', function (PDirectoryName) {
                _InitializeDB(pHeader, function callbackInitializeDB() {
                    _GetRptInfo(depCassandraIns, pAppID, function callbackGetRptInfo() {
                        var rptResult = arrRptInfo
                        reqRptIns.GetReportConfig(pHeader, function callbackGetReportConfig(JSInfo) {

                            var strJSWebserviceInfo = JSON.parse(JSInfo)
                            _PrintInfo('JasperServer Info ' + JSInfo, null)

                            reqRptHlpr.SetConfig('SERVER', strJSWebserviceInfo['SERVER'])
                            reqRptHlpr.SetConfig('PORT', strJSWebserviceInfo['PORT'])
                            reqRptHlpr.SetConfig('USERNAME', strJSWebserviceInfo['USERNAME'])
                            reqRptHlpr.SetConfig('PASSWORD', strJSWebserviceInfo['PASSWORD'])
                            reqRptHlpr.SetFolderPath(PDirectoryName)

                            reqRptHlpr.InitializeJasperServer(function callbackInitializeJasperServer() {
                                // Report insert
                                var arrMainReport = []
                                var arrSubReportList = []

                                // Split mainreport and subreport
                                for (var index = 0; index < lstArptdId.length; index++) {
                                    var ArptdId = lstArptdId[index]
                                    var obj = new JLinq(rptResult.rows).Where(function (dr) {
                                        return dr['arptd_id'] === ArptdId
                                    }).ToArray()

                                    var objRpt = {}
                                    if (obj.length > 0) {
                                        if (obj[0]['parent_arptd_id'] == 0) {
                                            objRpt[ArptdId] = obj[0]
                                            arrMainReport.push(objRpt)
                                        } else {
                                            objRpt[ArptdId] = obj[0]
                                            arrSubReportList.push(objRpt)
                                        }
                                    }
                                }

                                reqAsync.series({
                                    DoMainReport: function (parCB) {
                                        if (arrMainReport.length > 0) {
                                            _PrintInfo('No of Mainreport found ' + arrMainReport.length, null)
                                            _DoMainReport(arrMainReport, 0, rptResult, mTranDB, function callbackMainReport() {
                                                parCB(null, 'Success')
                                            })
                                        } else
                                            parCB(null, 'Success')
                                    },
                                    DoSubReport: function (parCB) {
                                        if (arrSubReportList.length > 0) {
                                            _PrintInfo('No of Subreport found ' + arrSubReportList.length, null)
                                            _DoSubReport(arrSubReportList, 0, rptResult, function callbackDOSubreport() {
                                                parCB(null, 'Success')
                                            })
                                        } else
                                            parCB(null, 'Success')
                                    }
                                },
                                    function (err, result) {
                                        reqFileHlpr.DisposeTempFile(PDirectoryName)
                                        resolve("SUCCESS");
                                    })
                            })
                        })
                    })
                })
            })
        } catch (ex) {
            console.log('Error in Jasperserver report ' + ex.toString())
            reject(ex);
        }
    });
}

function _DeleteJasperServer(pAppID, pHeader, pRptId, depCassandraIns) {
    return new Promise((resolve, reject) => {
        try {
            _InitializeDB(pHeader, function callbackInitializeDB() {
                _GetRptInfo(depCassandraIns, pAppID, function callbackGetRptInfo() {

                    reqRptIns.GetReportConfig(pHeader, function callbackGetReportConfig(JSInfo) {

                        var strJSWebserviceInfo = JSON.parse(JSInfo)
                        _PrintInfo('JasperServer info ' + JSInfo, null)

                        reqRptHlpr.SetConfig('SERVER', strJSWebserviceInfo['SERVER'])
                        reqRptHlpr.SetConfig('PORT', strJSWebserviceInfo['PORT'])
                        reqRptHlpr.SetConfig('USERNAME', strJSWebserviceInfo['USERNAME'])
                        reqRptHlpr.SetConfig('PASSWORD', strJSWebserviceInfo['PASSWORD'])


                        reqRptHlpr.InitializeJasperServer(function callbackInitializeJasperServer() {

                            var rptResult = arrRptInfo

                            var obj = new JLinq(rptResult.rows).Where(function (dr) {
                                return dr['arptd_id'] === pRptId
                            }).ToArray()

                            if (obj && obj != undefined && obj.length > 0) {
                                for (var i = 0; i < obj.length; i++) {
                                    var dr1 = obj[i]
                                    var parent_arptd_id = dr1['parent_arptd_id']
                                    if (parent_arptd_id == 0) // current report id is mainreport
                                        reqRptHlpr.DeleteMainReport(dr1['rpt_name'], function callbackDeleteMainReport() {
                                            resolve("SUCCESS");
                                        })
                                    else {
                                        var objMainReport = new JLinq(rptResult.rows).Where(function (dr) {
                                            return dr['arptd_id'] === parent_arptd_id
                                        }).ToArray()
                                        reqRptHlpr.DeleteSubReport(objMainReport[0]['rpt_name'], dr1['rpt_name'], function callbackDeleteSubReport() {
                                            resolve("SUCCESS");
                                        })
                                    }
                                }
                            } else
                                resolve("SUCCESS");
                        })
                    })
                })
            })
        } catch (ex) {
            _TraceError('Error in _DeleteJasperServer() ' + ex.toString())
            reject(ex);
        }
    })
}

function _GetRptInfo(pDBIns, pAppID, pCallback) {
    // if (arrRptInfo.length == 0) {
    if (Service_Mode.toUpperCase() == "LITE" || Service_Mode.toUpperCase() == "LITE_KAFKA") {
        var rptinfo = "SELECT * FROM APP_RPT_DEFINITIONS_INFO WHERE APP_ID='" + pAppID + "'"
        console.log('rptinfo query : ' + rptinfo)
        var query = pDBIns.raw(rptinfo);
        query.then(function (res, error) {
            try {
                if (error) {
                    _TraceError('Error on _GetRptInfo() ' + error)
                } else {
                    console.log("res " + res);
                    if (res.rows == undefined || res.rows == null) // for oracle
                        arrRptInfo = {
                            rows: arrKeyToLowerCase(res)
                        }
                    else // postgres sql
                        arrRptInfo = res
                }
                pCallback()
                //return res;
            } catch (error) {
                _TraceError('Error on _GetRptInfo() ' + error)
            }
        }).catch(function (error) {
            _TraceError('Error on _GetRptInfo() ' + error)
        });
    } else {
        var stRptInfo = "SELECT * FROM APP_RPT_DEFINITIONS_INFO WHERE APP_ID= ? ;"
        pDBIns.execute(stRptInfo, [pAppID], {
            prepare: true
        }, function callbackcltsetup(err, rptResult) {
            if (!err)
                arrRptInfo = rptResult
            else
                _TraceError('Error on _GetRptInfo() ' + err)
            pCallback()
        })
    }
    // } else
    //     pCallback()
}

// this will return object with keys in uppercase
function arrKeyToLowerCase(pArr) {
    try {
        var arrForReturn = [];
        if (pArr == undefined) {
            return arrForReturn;
        }
        for (var i = 0; i < pArr.length; i++) {
            var obj = pArr[i];
            var objNew = new Object();
            for (var key in obj) {
                var strLowerCaseKey = key.toLowerCase();
                if (obj[key] == null)
                    objNew[strLowerCaseKey] = '';
                else
                    objNew[strLowerCaseKey] = obj[key];

            }
            arrForReturn.push(objNew);
        }
        return arrForReturn;
    } catch (error) {
        _PrintError(error, '');
    }
}

function _PrintError(pMessage, pErrorCode) {
    // console.log('ClientDeploy : ' + pMessage)
    reqInstanceHelper.PrintError('ClientDeploy', pMessage, pErrorCode, pLogInfo);
}

function _PrintInfo(pMessage, pLogInfo) {
    // console.log('ClientDeploy : ' + pMessage)
    reqInstanceHelper.PrintInfo('ClientDeploy', pMessage, pLogInfo);
}

// Add / modify the mainreport
function _DoMainReport(pLstMainArptdId, pIndex, rptResult, pTranDB, pCallback) {

    var arrSubreport = []
    var objArptdId = pLstMainArptdId[pIndex]
    var dr1 = objArptdId[Object.keys(objArptdId)[0]]
    try {
        var objSubreport = new JLinq(rptResult.rows).Where(function (dr) {
            return dr['parent_arptd_id'] === Object.keys(objArptdId)[0]
        }).ToArray()
        for (var subRpt = 0; subRpt < objSubreport.length; subRpt++) {
            var drSubRpt = objSubreport[subRpt]
            var obj = {}
            obj[drSubRpt['rpt_name']] = drSubRpt['rpt_jrxml']
            arrSubreport.push(obj)
        }
        reqRptHlpr.IsReportExist(dr1['rpt_name'], '', function callbackIsReportExist(pStatus) {
            if (!pStatus) // publish new jasper report
                reqRptHlpr.PublishNewReport(dr1['rpt_name'], dr1['rpt_desc'], dr1['rpt_jrxml'], arrSubreport, pTranDB, function callbackPublishNewReport(pStatusNewReport) {
                    _PrintInfo('Published following main jasperreport successfully ' + dr1['rpt_name'], null)
                    pIndex = pIndex + 1
                    if (pLstMainArptdId.length == pIndex)
                        pCallback('success')
                    else
                        _DoMainReport(pLstMainArptdId, pIndex, rptResult, pTranDB, pCallback)
                })
            else // edit existing main report
                reqRptHlpr.ModifyMainreportJrxml(dr1['rpt_name'], dr1['rpt_desc'], dr1['rpt_jrxml'], arrSubreport, pTranDB, function callbackModifyMainreportJrxml() {
                    _PrintInfo('Modified following jasperreport successfully ' + dr1['rpt_name'], null)
                    pIndex = pIndex + 1
                    if (pLstMainArptdId.length == pIndex)
                        pCallback('success')
                    else
                        _DoMainReport(pLstMainArptdId, pIndex, rptResult, pTranDB, pCallback)
                })
        })
    } catch (ex) {
        _TraceError('Error on _DoMainReport()' + ex)
    }
}

// Add / modify the subreport 
function _DoSubReport(pLstSubArptdId, pIndex, rptResult, pCallback) {
    try {
        var objArptdId = pLstSubArptdId[pIndex]
        var dr1 = objArptdId[Object.keys(objArptdId)[0]]
        var parent_arptd_id = dr1['parent_arptd_id']

        var objMainReport = new JLinq(rptResult.rows).Where(function (dr) {
            return dr['arptd_id'] === parent_arptd_id
        }).ToArray()
        reqRptHlpr.IsReportExist(objMainReport[0]['rpt_name'], dr1['rpt_name'], function callbackIsReportExist(pStatus) {
            if (!pStatus)
                reqRptHlpr.AddSubReport(objMainReport[0]['rpt_name'], dr1['rpt_name'], dr1['rpt_jrxml'], function callbackAddSubReport() {
                    _PrintInfo('Published following subreport successfully ' + dr1['rpt_name'] + ' on ' + objMainReport[0]['rpt_name'], null)
                    pIndex = pIndex + 1
                    if (pLstSubArptdId.length == pIndex)
                        pCallback('success')
                    else
                        _DoSubReport(pLstSubArptdId, pIndex, rptResult, pCallback)
                })
            else
                reqRptHlpr.ModifySubReportJrxml(objMainReport[0]['rpt_name'], dr1['rpt_name'], dr1['rpt_jrxml'], function callbackModifySubReportJrxml(pStatus) {
                    _PrintInfo('Modified following subreport successfully ' + dr1['rpt_name'] + ' on ' + objMainReport[0]['rpt_name'], null)
                    pIndex = pIndex + 1
                    if (pLstSubArptdId.length == pIndex)
                        pCallback('success')
                    else
                        _DoSubReport(pLstSubArptdId, pIndex, rptResult, pCallback)
                })
        })
    } catch (ex) {
        _TraceError('Error on _DoSubReport()' + ex)
    }
}

function _InitializeDB(pHeaders, pCallback) {
    try {
        tranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
            mTranDB = pSession
            pCallback('Success')
        })
    } catch (ex) {
        _TraceError('Error on _InitializeDB() instance ' + ex)
    }
}

function _TraceError(pError) {
    console.log(pError)
}

function* ExecuteRemotePostgresQueries(ClientId, AppId, TenantId, EnvCode, TemplateID, pBatchQueries) {
    if (!pBatchQueries || pBatchQueries.length == 0) {
        return "SUCCESS";
    }
    PostgresKey = StringFormat("TRANDB~CLT-{0}~APP-{1}~TNT-{2}~ENV-{3}", ClientId, AppId, TenantId, (EnvCode.toUpperCase() == "DEV_DEP" ? "DEV" : EnvCode));
    var strPostgres = yield getRedishEntry(PostgresKey);
    var objPostgreSql = JSON.parse(strPostgres);

    var PGDatabase = objPostgreSql.Database;
    var PostgresIp = objPostgreSql.Server;
    var PostgresPort = objPostgreSql.Port;
    var PostgresUserName = objPostgreSql.UserID;
    var PostgresPassword = objPostgreSql.Password;
    var SearchPath = objPostgreSql.SearchPath;
    var PgSession = null;
    try {
        PgSession = yield __GetPostgresqlSession(PostgresIp, PostgresPort, PGDatabase, SearchPath, PostgresUserName, PostgresPassword);
        for (var iQry = 0; iQry < pBatchQueries.length; iQry++) {
            var ExecutionResult = yield ExecutePostGresqlQuery(PgSession, pBatchQueries[iQry]);
            if (ExecutionResult != "SUCCESS") {
                throw new Error(ExecutionResult);
            }
        }
    } catch (e) {
        throw e;
    } finally {
        if (PgSession) {
            PgSession.destroy();
        }
    }
    return "SUCCESS";
};

function* PrepareRemoteSolrSchema(ClientId, AppId, TenantId, EnvCode, TemplateID, pSolrJson) {
    if (!pSolrJson || pSolrJson.length == 0) {
        return "SUCCESS";
    }
    var SolrKey = StringFormat("SOLR_SEARCH~CLT-{0}~APP-{1}~TNT-{2}~ENV-{3}", ClientId, AppId, TenantId, (EnvCode.toUpperCase() == "DEV_DEP" ? "DEV" : EnvCode));
    var strSolr = yield getRedishEntry(SolrKey);
    var objSolrJson = JSON.parse(strSolr);

    var TranCore = objSolrJson.CORE.DYNAMIC_CORE;
    var AtmtCore = objSolrJson.CORE.STATIC_CORE;
    var SolrIp = objSolrJson.SERVER;
    var SolrPort = objSolrJson.PORT;

    var objSolrConfig = {
        URI: StringFormat("http://{0}:{1}/solr/", SolrIp, SolrPort),
        STATIC_CORE: AtmtCore,
        DYNAMIC_CORE: TranCore,
        TRACE_LOG_CORE: null,
        AUDIT_LOG_CORE: null,
        LANG_DICTIONARY: null,
        LANG_DIC_NAMESPACE: null
    }
    for (var islr = 0; islr < pSolrJson.length; islr++) {
        var objSolrInfo = pSolrJson[islr];
        if (objSolrInfo["TRAN_INSERTION"] && objSolrInfo["TRAN_INSERTION"].length > 0) {
            var objInsertTranFields = objSolrInfo["TRAN_INSERTION"];
            var Result = yield __CreateSolrSearchField(objSolrConfig, objInsertTranFields, true);
            if (Result != "SUCCESS") {
                throw new Error(Result);
            }
        }

        if (objSolrInfo["TRAN_DELETION"] && objSolrInfo["TRAN_DELETION"].length > 0) {
            var objDeleteTranFields = objSolrInfo["TRAN_DELETION"];
            var Result = yield __DeleteSolrSearchField(objSolrConfig, objDeleteTranFields, true)
            if (Result != "SUCCESS") {
                throw new Error(Result);
            }
        }

        if (objSolrInfo["ATMT_INSERTION"] && objSolrInfo["ATMT_INSERTION"].length > 0) {
            var objInsertAtmtFields = objSolrInfo["ATMT_INSERTION"];
            var Result = yield __CreateSolrSearchField(objSolrConfig, objInsertAtmtFields, false);
            if (Result != "SUCCESS") {
                throw new Error(Result);
            }
        }
    }
    return "SUCCESS";
};

function* __CreateSolrSearchField(objSolrConfig, pFields, pTran) {
    var CoreName = "";
    if (pTran) {
        CoreName = objSolrConfig.DYNAMIC_CORE;
    } else {
        CoreName = objSolrConfig.STATIC_CORE;
    }
    var strSolrUri = objSolrConfig.URI;
    if (!strSolrUri.endsWith("/")) {
        strSolrUri = strSolrUri & "/";
    }

    var strRespMethod = {
        "wt": "json"
    };
    if (pFields.length > 0) {
        var strSchemaQuery = strSolrUri + CoreName + "/schema/fields";
        var strFieldCreate = strSolrUri + CoreName + "/schema?commit=true";
        var strResponseData = yield HttpRequest(strSchemaQuery, "GET", undefined, undefined, undefined, undefined, strRespMethod);
        var objFieldData = ParseJson(strResponseData);
        if (!objFieldData) {
            throw new Error(strResponseData);
        }
        var ExisitingField = objFieldData["fields"];
        for (var idr = 0; idr < pFields.length; idr++) {
            var FieldInfo = pFields[idr];
            var FieldItem = undefined;
            for (var oFld = 0; oFld < ExisitingField.length; oFld++) {
                var pField = ExisitingField[oFld];
                if (pField["name"].toString().toUpperCase() == FieldInfo["NAME"].toString().toUpperCase()) {
                    FieldItem = pField;
                }
            }
            if (!FieldItem) {
                var strFieldInfo = ParseJson(StringFormat("{{ \"add-field\" : {{ \"name\" : \"{0}\", \"type\" : \"{1}\" , \"stored\" : {2}, \"indexed\" : {3}, \"required\" : {4} }} }}", FieldInfo["NAME"].toString(), __GetSolrFieldType(FieldInfo["TYPE"].toString()), "true", "true", "false"));
                var strInsertResult = yield HttpRequest(strFieldCreate, "POST", strFieldInfo, "application/json", undefined, undefined, strRespMethod);
                var objFieldRes = ParseJson(strInsertResult);
                if (!objFieldRes) {
                    throw new Error(strInsertResult);
                }
                var objFieldError = objFieldRes["errors"];
                if (objFieldError && objFieldError.length > 0) {
                    var sbError = new stringbuilder()
                    objFieldError.forEach(function (err) {
                        if (sbError.toString() != "") {
                            sbError.appendLine();
                        }
                        sbError.append(err["errorMessages"].toString());
                    });
                    throw new Error(sbError.toString())
                }
            } else if (!FieldItem["indexed"]) {
                FieldItem["NAME"] = FieldItem["name"].toString();
                var DeleteItem = [];
                DeleteItem.push(FieldItem);
                __DeleteSolrSearchField(objSolrConfig, DeleteItem, pTran)
                var strFieldInfo = ParseJson(StringFormat("{{ \"add-field\" : {{ \"name\" : \"{0}\", \"type\" : \"{1}\" , \"stored\" : {2}, \"indexed\" : {3}, \"required\" : {4} }} }}", FieldInfo["NAME"].toString(), __GetSolrFieldType(FieldInfo["TYPE"].toString()), "true", "true", "false"));
                var strInsertResult = yield HttpRequest(strFieldCreate, "POST", strFieldInfo, "application/json", undefined, undefined, strRespMethod);
                var objFieldRes = ParseJson(strInsertResult);
                if (!objFieldRes) {
                    throw new Error(strInsertResult);
                }
                var objFieldError = objFieldRes["errors"];
                if (objFieldError && objFieldError.length > 0) {
                    var sbError = new stringbuilder();
                    objFieldError.forEach(function (err) {
                        if (sbError.toString() != "") {
                            sbError.appendLine();
                        }
                        sbError.append(err["errorMessages"].toString());
                    });
                    throw new Error(sbError.toString());
                }
            }
        }

        //Fake Delete
        try {
            var strFakeDeleteUri = strSolrUri + CoreName + "/update?commit=true";
            var strDeleteQry = StringFormat("<delete><query>id:{0}</query></delete>", "0");
            var strFakeDeleteResult = yield HttpRequest(strFakeDeleteUri, "POST", strDeleteQry, "application/json", undefined, undefined, {
                "wt": "xml"
            });
            var objFakeRes = ParseJson(strFakeDeleteResult);
            if (!objFakeRes) {
                throw new Error(strFakeDeleteResult);
            }
        } catch (e) { }
    }
    return "SUCCESS";
};

function* __DeleteSolrSearchField(objSolrConfig, pFields, pTran) {
    var CoreName = "";
    if (pTran) {
        CoreName = objSolrConfig.DYNAMIC_CORE;
    } else {
        CoreName = objSolrConfig.STATIC_CORE;
    }
    var strSolrUri = objSolrConfig.URI;
    if (!strSolrUri.endsWith("/")) {
        strSolrUri = strSolrUri & "/";
    }

    var strRespMethod = {
        "wt": "json"
    };
    if (pFields.length > 0) {
        var strSchemaQuery = strSolrUri + CoreName + "/schema/fields";
        var strFieldDelete = strSolrUri + CoreName + "/schema?commit=true"
        var strResponseData = yield HttpRequest(strSchemaQuery, "GET", undefined, undefined, undefined, undefined, strRespMethod);
        var objFieldData = ParseJson(strResponseData);
        if (!objFieldData) {
            throw new Error(strResponseData);
        }
        var ExisitingField = objFieldData["fields"];
        for (var idr = 0; idr < pFields.length; idr++) {
            var FieldInfo = pFields[idr];
            var FieldExists = false;
            for (var oFld = 0; oFld < ExisitingField.length; oFld++) {
                var pField = ExisitingField[oFld];
                if (pField["name"].toString().toUpperCase() == FieldInfo["NAME"].toString().toUpperCase()) {
                    FieldExists = true;
                }
            }
            if (FieldExists) {
                var strFieldInfo = ParseJson(StringFormat("{{ \"delete-field\" : {{ \"name\" : \"{0}\" }} }}", FieldInfo["NAME"].toString()));
                var strDeleteResult = yield HttpRequest(strFieldDelete, "POST", strFieldInfo, "application/json", undefined, undefined, strRespMethod);
                var objFieldRes = ParseJson(strDeleteResult);
                if (!objFieldRes) {
                    throw new Error(strDeleteResult);
                }
                var objFieldError = objFieldRes["errors"];
                if (objFieldError && objFieldError.length > 0) {
                    var sbError = new stringbuilder();
                    objFieldError.forEach(function (err) {
                        if (sbError.toString() != "") {
                            sbError.appendLine();
                        }
                        sbError.append(err["errorMessages"].toString());
                    });
                    throw new Error(sbError.toString());
                }
            }
        }

        //Fake Delete
        try {
            var strFakeDeleteUri = strSolrUri + CoreName + "/update?commit=true";
            var strDeleteQry = StringFormat("<delete><query>id:{0}</query></delete>", "0");
            var strFakeDeleteResult = yield HttpRequest(strFakeDeleteUri, "POST", strDeleteQry, "application/json", undefined, undefined, {
                "wt": "xml"
            });
            var objFakeRes = ParseJson(strFakeDeleteResult);
            if (!objFakeRes) {
                throw new Error(strFakeDeleteResult);
            }
        } catch (e) { }
    }
    return "SUCCESS";
};

function __GetSolrFieldType(pName) {
    var FieldType = "";
    switch (pName) {
        case "TEXT":
            FieldType = "text_general";
            break;
        case "NUMBER":
            FieldType = "int"
            break;
        case "DATETIME":
            FieldType = "date"
            break;
        case "DATE":
            FieldType = "date"
            break;
        default:
            FieldType = "string"
            break;
    };
    return FieldType;
};

function* PrepareRemoteCassandraSessions(ClientId, AppId, TenantId, EnvCode) {
    var CassandraKey = StringFormat("CASSANDRA~CLT-{0}~APP-{1}~TNT-{2}~ENV-{3}", ClientId, AppId, TenantId, (EnvCode.toUpperCase() == "DEV_DEP" ? "DEV" : EnvCode));
    var strCassandra = yield getRedishEntry(CassandraKey);
    var objCassandra = JSON.parse(strCassandra);
    var KeySpaces = {};
    for (var iCasServer = 0; iCasServer < objCassandra.CassandraServers.length; iCasServer++) {
        var CassandraServer = objCassandra.CassandraServers[iCasServer];
        for (var iKeyspace = 0; iKeyspace < CassandraServer.CassandraKeySpaces.length; iKeyspace++) {
            var KeyspaceInfo = CassandraServer.CassandraKeySpaces[iKeyspace];
            if (typeof KeySpaces[KeyspaceInfo.Code] == "undefined") {
                KeySpaces[KeyspaceInfo.Code] = yield __GetSession(CassandraServer.Server, CassandraServer.Port, KeyspaceInfo.KeySpace, CassandraServer.UserName, encHelper.DoDecrypt(CassandraServer.Password.toLowerCase()));
            }
        }
    }
    return KeySpaces;
};

function* GetDeployedComponentInfo(pClientId, pTemplateId, pCode, objEnvCas) {
    var strSelectDeployments = "select * from apaas_deployments where client_id = ? and dt_id = ?";
    var Deployments = yield executecassandra(objEnvCas, strSelectDeployments, [pClientId, pTemplateId]);
    var Component = null;
    var Instances = new JLinq(Deployments.rows).Where(function (row) {
        var result = false;
        var MachineJson = JSON.parse(row.machine_info_json);
        MachineJson.forEach(function (comp) {
            if (comp.APC_CODE == pCode) {
                Component = comp;
                result = true;
            }
        });
        return result;
    }).ToArray();
    if (Instances.length > 0 && Component) {
        var MachineJson = JSON.parse(Instances[0].machine_info_json);
        var PortJson = {};
        if (Instances[0].machine_port_json && Instances[0].machine_port_json != "") {
            PortJson = JSON.parse(Instances[0].machine_port_json);
        }
        var MachineIp = "";
        if (Instances[0].machine_ip && Instances[0].machine_ip != "") {
            MachineIp = Instances[0].machine_ip;
        }

        var ComponentInfo = yield GetComponentInfo(Component.APC_ID, null, null, objEnvCas);
        ComponentInfo.PORT_JSON = PortJson;
        ComponentInfo.MACHINE_IP = MachineIp;
        for (var iChildCnt = 0; iChildCnt < Component.CHILD_COMPONENTS.length; iChildCnt++) {
            var ChildCompData = Component.CHILD_COMPONENTS[iChildCnt];
            var ChildComponentInfo = yield GetComponentInfo(ChildCompData.APC_ID, null, null, objEnvCas);
            ChildComponentInfo.PORT_JSON = PortJson;
            ChildComponentInfo.MACHINE_IP = MachineIp;
            ComponentInfo.CHILD_COMPONENTS.push(ChildComponentInfo);
        }
        return ComponentInfo;
    } else {
        return null;
    }
};

function* GetComponentInfo(pApcid, pApcCode, pApcName, objEnvCas) {
    var strComponentSelect = "select apc_id, apc_type, apc_category, apc_code, apc_desc, apc_help_text, apc_info_json, apc_priority_order, apc_platform_type, apc_priority_order, change_content, copy_content, post_execution_json, pre_execution_json, run_cmd, version_no from apaas_components where apc_id = ?";
    var aPComponent = yield executecassandra(objEnvCas, strComponentSelect, [pApcid], true);
    if (aPComponent.rowLength == 0 && pApcName) {
        throw new Error(StringFormat("Component '{0}' is not found", pApcName));
    }

    var ComponentInfoJson = {};
    if (typeof aPComponent.rows[0].apc_info_json == "string" && aPComponent.rows[0].apc_info_json != "") {
        ComponentInfoJson = JSON.parse(aPComponent.rows[0].apc_info_json);
    }

    var PreExecutionJson = {};
    var PostExecutionJson = {};
    if (aPComponent.rows[0].pre_execution_json && aPComponent.rows[0].pre_execution_json != "") {
        PreExecutionJson = JSON.parse(aPComponent.rows[0].pre_execution_json.toString());
    }
    if (aPComponent.rows[0].post_execution_json && aPComponent.rows[0].post_execution_json != "") {
        PostExecutionJson = JSON.parse(aPComponent.rows[0].post_execution_json.toString());
    }

    var CopyContent = {};
    if (aPComponent.rows[0].copy_content && aPComponent.rows[0].copy_content != "") {
        CopyContent = JSON.parse(aPComponent.rows[0].copy_content.toString());
    }

    var ChangeContent = {};
    if (aPComponent.rows[0].change_content && aPComponent.rows[0].change_content != "") {
        ChangeContent = JSON.parse(aPComponent.rows[0].change_content.toString());
    }

    var RunScripts = {};
    if (aPComponent.rows[0].run_cmd && aPComponent.rows[0].run_cmd != "") {
        RunScripts = JSON.parse(aPComponent.rows[0].run_cmd.toString());
    }

    if (!ComponentInfoJson.NEED_NODE_ADMIN) {
        ComponentInfoJson.NEED_NODE_ADMIN = "Y";
    }

    var ComponentInfo = {
        APC_ID: aPComponent.rows[0].apc_id,
        APC_TYPE: aPComponent.rows[0].apc_type,
        APC_CATEGORY: aPComponent.rows[0].apc_category,
        APC_CODE: aPComponent.rows[0].apc_code,
        APC_NAME: aPComponent.rows[0].apc_desc,
        APC_PLATFORM: aPComponent.rows[0].apc_os,
        APC_ORDER: aPComponent.rows[0].apc_priority_order,
        APC_INFO_JSON: ComponentInfoJson,
        COPY_CONTENT: CopyContent,
        CHANGE_CONTENT: ChangeContent,
        RUN_SCRIPTS: RunScripts,
        CHILD_COMPONENTS: [],
        COMPONENT_PRE_EXECUTION_JSON: PreExecutionJson,
        COMPONENT_POST_EXECUTION_JSON: PostExecutionJson
    };
    if (pApcCode && ComponentInfo.APC_CODE != pApcCode) {
        throw new Error("Component " + ComponentInfo.APC_NAME + " code is mismatched");
    }
    return ComponentInfo;
};

function* executecassandra(objSession, pQuery, pParams, pPrepare) {
    return yield new Promise((resolve, reject) => {
        if (objSession == null) {
            throw new Error("Cassandra session not found...");
        }
        objSession.execute(pQuery, pParams, {
            prepare: pPrepare
        }, function (err, result) {
            if (err) {
                var ErrorMessage = "Error occurs while executing query " + pQuery + "\r\n" + ". InnerException :" + err.toString()
                reject(err);
            }
            resolve(result);
        });
    });
};

function* ExecutePostGresqlQuery(pSession, pQryDetail) {
    return yield new Promise((resolve, reject) => {
        pSession.raw(pQryDetail.query, pQryDetail.params).then(function (result) {
            resolve("SUCCESS");
        }, function (err) {
            var ErrorMessage = "Error occurs while executing query " + pQryDetail.query + err.toString();
            reject(new Error(ErrorMessage));
            return;
        });
    });
};

function* __GetSession(server, port, pKeyspace, pUsername, pPassword) {
    return yield new Promise((resolve, reject) => {
        var authProvider = new cassandra.auth.PlainTextAuthProvider(pUsername, pPassword);
        var cnfSession = new cassandra.Client({
            contactPoints: [server + ":" + port],
            keyspace: pKeyspace,
            authProvider: authProvider
        });
        cnfSession.servername = server;
        cnfSession.serverport = port;
        cnfSession.connect(function (err) {
            if (err) {
                reject(err);
            }
            resolve(cnfSession);
        });
    });
};

function* __GetPostgresqlSession(PostGresIp, PostGresPort, DataBase, SearchPath, Username, Password) {
    return yield new Promise((resolve, reject) => {
        var PgSession = reqKnex({
            client: "pg",
            native: false,
            connection: {
                host: PostGresIp,
                port: PostGresPort,
                user: Username,
                password: Password,
                database: DataBase
            },
            searchPath: SearchPath,
            pool: {
                max: 5,
                min: 1,
                idle: 10000
            }
        });
        resolve(PgSession);
    });
};

function* __GetOracleSession(OracleServerIp, OraPort, DataBase, SearchPath, Username, Password) {
    return yield new Promise((resolve, reject) => {
        var OraSession = reqKnex({
            client: "oracledb",
            native: false,
            connection: {
                user: Username,
                password: Password,
                connectString: '//' + OracleServerIp + ':' + OraPort + '/' + DataBase
            },
            pool: {
                max: 5,
                min: 1,
                idle: 10000
            }
        });
        resolve(OraSession);
    });
};
var StringReplaceAll = function (pStr, pWord, pReplaceStr) {
    pStr = pStr.replace(RegExp(pWord, "gi"), pReplaceStr);
    return pStr;
};

function* HttpRequest(pUri, pMethod, pPostData, pContentType, pHeaders, pTimeOut, pQs) {
    return yield new Promise((resolve, reject) => {
        var TIMEOUT_MAX = 2147483647;
        var isJson = false;
        if (pContentType) {
            isJson = pContentType.indexOf("application/json") > -1 ? true : false
        }
        var headers = [{
            name: 'content-type',
            value: pContentType
        }];
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
                Message = Message + "\r\n" + err.toString()
                reject(Message);
                return;
            }
            resolve(body);
        });
    });
};

function* HttpFormDataRequest(pUri, pFormdata) {
    return yield new Promise((resolve, reject) => {
        request.post({
            uri: pUri.toString(),
            formData: pFormdata
        }, function (err, httpResponse, body) {
            if (err) {
                reject(err);
                return;
            }
            resolve(body);
        });
    });
};

function HttpSyncRequest(pUri, pMethod, pPostData, pContentType, pHeaders, pTimeOut) {
    var isJson = false;
    if (pContentType) {
        isJson = pContentType.indexOf("application/json") > -1 ? true : false
    }
    var headers = {
        'content-type': pContentType
    };
    if (pHeaders) {
        for (var iHeader in pHeaders) {
            headers[iHeader] = pHeaders[iHeader];
        }
    }
    var Responsebody = SyncRequest(pMethod.toString().toUpperCase(), pUri.toString(), {
        body: JSON.stringify(pPostData),
        timeout: pTimeOut ? pTimeOut : false,
        socketTimeout: false,
        headers: headers
    });
    var data = null;
    if (Responsebody.body) {
        data = Responsebody.body.toString();
    }
    return data;
};

function* getRedishEntry(pKey) {
    return yield new Promise((resolve, reject) => {
        reqRedisInstance.GetRedisConnection(function (error, clientR) {
            if (error) {
                reject(error);
            } else {
                clientR.get(pKey, function (err, reply) {
                    if (err) {
                        reject(err);
                    }
                    if (!reply) {
                        reject("Redish Key " + pKey + " not found");
                        return;
                    }
                    resolve(reply.toString());
                });
            }
        });
    });
};

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

function stringbuilder(params) {
    if (this instanceof stringbuilder == false) {
        throw new Error("please use keyword new for stringbuilder...");
    }
    this.__mString = "";
    this.append = function (pStr) {
        pStr = pStr || "";
        this.__mString = this.__mString + pStr;
    };
    this.appendLine = function (pStr) {
        if (pStr) {
            if (this.__mString != "") {
                this.__mString = this.__mString + "\r\n" + pStr + "\r\n";
            }
        } else {
            if (this.__mString != "") {
                this.__mString = this.__mString + "\r\n";
            }
        }
    };
    this.appendFormat = function (pStr) {
        pStr = pStr || "";
        this.__mString = this.__mString + StringFormat.apply(null, arguments);
    };
    this.toString = function () {
        return this.__mString.toString();
    };
    this.toInlineString = function () {
        return this.__mString.replace(/(\r\n|\n|\r)/gm, "").toString();
    };
};


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

function* ExtractZipFile(pPath, pBuffer) {
    return yield new Promise((resolve, reject) => {
        extract(pBuffer, pPath, {
            format: 'zip'
        })
            .then(function () {
                resolve("SUCCESS");
            })
            .catch(function (err) {
                if (err) {
                    reject(err);
                }
            });
    });
};

var ParseJson = function (pStr, pEscaped) {
    var JsonData = null;
    try {
        if (typeof pStr == "object") {
            JsonData = pStr;
        } else {
            if (pEscaped) {
                pStr = pStr.toString();
                pStr = pStr.replace(RegExp("\r", "gi"), " ");
                pStr = pStr.replace(RegExp("\n", "gi"), " ");
                pStr = pStr.replace(RegExp("\t", "gi"), " ");
                // pStr = pStr.replace(RegExp("\r", "gi"), "\\r");
                // pStr = pStr.replace(RegExp("\n", "gi"), "\\n");
                // pStr = pStr.replace(RegExp("\t", "gi"), "\\t");
            }
            JsonData = JSON.parse(pStr.toString() || "");
        }
    } catch (e) {
        JsonData = null;
    }
    return JsonData;
};

function* ExecuteQueryinFXDB(pgKey, pSchema, pQuery, pCallBack) {
    var headers = {
        routingkey: pgKey
    }
    reqDBInstance.GetFXDBConnection(headers, pSchema, null, function cb1(pDBClient) {
        reqDBInstance.ExecuteQuery(pDBClient, pQuery, null, function cb2(pError, pResult) {
            if (pError) {
                pCallBack(pError)
            }
            if (!pResult) {
                pCallBack("FX DB not found");
                return;
            }
            pCallBack(pResult.rows);
        });
    });
};

function* DeployJasperServerComponent(ClientParams) {

    var ClientId = ClientParams["CLIENT_ID"];
    var AppId = ClientParams["APP_ID"];
    var TenantId = ClientParams["TENANT_ID"];
    var EnvCode = ClientParams["ENV_CODE"].toString().toUpperCase();
    var objBatchQueries = ClientParams["BATCH_QUERIES"];
    var ServiceModel = ClientParams["SERVICE_MODEL"];
    var DB_TYPE = ClientParams["DB_TYPE"];


    // ClientId = '1304'
    // AppId = '4'
    // TenantId = '3'
    // EnvCode = 'PIS_DEMO_S1'
    // var objBatchQueries = {
    //     items: contents
    // }
    // ServiceModel = 'LITE'
    // DB_TYPE = 'oracle'

    Service_Mode = ServiceModel;
    _PrintInfo('Current Service Model is ' + ServiceModel + ', DB_TYPE is ' + DB_TYPE, null)

    if (Service_Mode.toUpperCase() == "LITE" || Service_Mode.toUpperCase() == "LITE_KAFKA") {
        if (!objBatchQueries || objBatchQueries.items.length == 0) {
            throw new Error("SUCCESS");
        }

        if (DB_TYPE.toUpperCase() === 'PG') {

            PostgresKey = StringFormat("POSTGRES~CLT-{0}~APP-{1}~TNT-{2}~ENV-{3}", ClientId, AppId, TenantId, (EnvCode.toUpperCase() == "DEV_DEP" ? "DEV" : EnvCode));
            var strPostgres = yield getRedishEntry(PostgresKey);
            var pgServers = JSON.parse(strPostgres).PostgresServers;
            var objPostgreSql; //JSON.parse(strPostgres).PostgresServers[0];
            var SearchPath = '';
            for (var pgs = 0; pgs < pgServers.length; pgs++) {
                objPostgreSql = pgServers[pgs];
                var objDep = new JLinq(objPostgreSql.PostgresSchemas).Where(function (dr) {
                    return dr['Code'].toLowerCase() === 'dep_cas'
                }).ToArray()
                if (objDep.length > 0) {
                    SearchPath = objDep[0].Schema;
                    break;
                } else {
                    continue
                }
            }
            var PGDatabase = objPostgreSql.Database;
            var PostgresIp = objPostgreSql.Server;
            var PostgresPort = objPostgreSql.Port;
            var PostgresUserName = objPostgreSql.UserID;
            var PostgresPassword = objPostgreSql.Password;

            var PgSession = yield __GetPostgresqlSession(PostgresIp, PostgresPort, PGDatabase, SearchPath, PostgresUserName, PostgresPassword);
            var lstArptdId = [];
            arrRptInfo = [];
            var Header = {
                routingkey: 'CLT-' + ClientId + '~APP-' + AppId + '~TNT-' + TenantId + '~ENV-' + EnvCode
            }
            for (var iQry = 0; iQry < objBatchQueries.items.length; iQry++) {
                var QueryDetail = objBatchQueries.items[iQry];
                if (QueryDetail.query == "") {
                    continue;
                }
                if (QueryDetail.query.indexOf("delete from ") >= 0) {
                    yield _DeleteJasperServer(AppId, Header, QueryDetail.params[1].toString(), PgSession)
                    if (QueryDetail.params.length > 2) {
                        QueryDetail.params.pop('4')
                        QueryDetail.params.pop('3')
                        QueryDetail.params.pop('2')
                    }
                } else {
                    _AddRptID(lstArptdId, QueryDetail.params[1].toString()) // insert report arptdId
                    var strTmp1 = QueryDetail.query.split("values(")
                    var strTmp2 = strTmp1[1].split(',')
                    var strQryParamLength = strTmp2.length
                    if (QueryDetail.params.length > strQryParamLength) {
                        for (i = strQryParamLength; i < QueryDetail.params.length; i++) {
                            QueryDetail.params.pop(strQryParamLength - 1)
                        }
                        //QueryDetail.params.pop('12')
                    }
                }
                yield ExecutePostGresqlQuery(PgSession, QueryDetail);
            }
            if (lstArptdId.length > 0) {
                yield PublishJasperServer(AppId, Header, lstArptdId, PgSession);
            }
        } else {
            var OracleKey = StringFormat("ORACLE~CLT-{0}~APP-{1}~TNT-{2}~ENV-{3}", ClientId, AppId, TenantId, (EnvCode.toUpperCase() == "DEV_DEP" ? "DEV" : EnvCode));
            var strOracle = yield getRedishEntry(OracleKey);
            var OraServers = JSON.parse(strOracle).OracleServers;
            var objOracle; //JSON.parse(strPostgres).PostgresServers[0];
            var UserId = '';
            for (var ora = 0; ora < OraServers.length; ora++) {
                objOracle = OraServers[ora];
                var objDep = new JLinq(objOracle.OracleSchemas).Where(function (dr) {
                    return dr['Code'].toLowerCase() === 'dep_cas'
                }).ToArray()
                if (objDep.length > 0) {
                    UserId = objDep[0].Schema;
                    break;
                } else {
                    continue
                }
            }
            var OraDatabase = objOracle.Database;
            var OraServerIp = objOracle.Server;
            var OraclePort = objOracle.Port;
            var UserName = UserId;
            var Password = objOracle.Password;

            var OraSession = yield __GetOracleSession(OraServerIp, OraclePort, OraDatabase, UserId, UserName, Password);
            var lstArptdId = [];
            arrRptInfo = [];
            var Header = {
                routingkey: 'CLT-' + ClientId + '~APP-' + AppId + '~TNT-' + TenantId + '~ENV-' + EnvCode
            }
            for (var iQry = 0; iQry < objBatchQueries.items.length; iQry++) {
                var QueryDetail = objBatchQueries.items[iQry];
                if (QueryDetail.query == "") {
                    continue;
                }
                if (QueryDetail.query.indexOf("delete from ") >= 0) {
                    yield _DeleteJasperServer(AppId, Header, QueryDetail.params[1].toString(), OraSession)
                    if (QueryDetail.params.length > 2) {
                        QueryDetail.params.pop('4')
                        QueryDetail.params.pop('3')
                        QueryDetail.params.pop('2')
                    }
                } else {
                    _AddRptID(lstArptdId, QueryDetail.params[1].toString()) // insert report arptdId
                    var strTmp1 = QueryDetail.query.split("values(")
                    var strTmp2 = strTmp1[1].split(',')
                    var strQryParamLength = strTmp2.length
                    if (QueryDetail.params.length > strQryParamLength) {
                        for (i = strQryParamLength; i < QueryDetail.params.length; i++) {
                            QueryDetail.params.pop(strQryParamLength - 1)
                        }
                        //QueryDetail.params.pop('12')
                    }
                }
                yield ExecutePostGresqlQuery(OraSession, QueryDetail);


            }
            if (lstArptdId.length > 0) {
                yield PublishJasperServer(AppId, Header, lstArptdId, OraSession);
            }
        }
    } else {
        var Keyspaces = yield PrepareRemoteCassandraSessions(ClientId, AppId, TenantId, EnvCode);
        var objDepCas = Keyspaces["dep_cas"];
        var objCltCas = Keyspaces["clt_cas"];
        if (!objBatchQueries || objBatchQueries.items.length == 0) {
            throw new Error("SUCCESS");
        }
        var lstArptdId = [];
        arrRptInfo = [];
        var Header = {
            routingkey: 'CLT-' + ClientId + '~APP-' + AppId + '~TNT-' + TenantId + '~ENV-' + EnvCode
        }
        for (var iQry = 0; iQry < objBatchQueries.items.length; iQry++) {
            var QueryDetail = objBatchQueries.items[iQry];
            if (QueryDetail.query == "") {
                continue;
            }
            if (QueryDetail.query.indexOf("delete from ") >= 0) {
                yield _DeleteJasperServer(AppId, Header, QueryDetail.params[1].toString(), objDepCas)
                if (QueryDetail.params.length > 2) {
                    QueryDetail.params.pop('4')
                    QueryDetail.params.pop('3')
                    QueryDetail.params.pop('2')
                }
            } else {
                _AddRptID(lstArptdId, QueryDetail.params[1].toString()) // insert report arptdId
                var strTmp1 = QueryDetail.query.split("values(")
                var strTmp2 = strTmp1[1].split(',')
                var strQryParamLength = strTmp2.length
                if (QueryDetail.params.length > strQryParamLength) {
                    for (i = strQryParamLength; i < QueryDetail.params.length; i++) {
                        QueryDetail.params.pop(strQryParamLength - 1)
                    }
                    //QueryDetail.params.pop('12')
                }
            }
            yield executecassandra(objDepCas, QueryDetail.query, QueryDetail.params, true);


        }
        if (lstArptdId.length > 0) {
            yield PublishJasperServer(AppId, Header, lstArptdId, objDepCas);
        }
    }
    _PrintInfo('Successfully Deployed ', null)
    return "SUCCESS";
};

function PreparePostData(req) {
    return new Promise(function (resolve, reject) {
        var contentType = req.headers["content-type"];
        if (contentType.indexOf("multipart/form-data") > -1) {
            resolve({
                params: req.body,
                files: req.files
            });
        } else {
            var ClientParams = req.body;
            resolve({
                params: ClientParams,
                files: null
            });
        }
    });
};

var PostRoutes = {
    ClientEnvironmentDeploy: ClientEnvironmentDeploy,
    GetDeployedHistory: GetDeployedHistory,
    DeployJasperServerComponent: DeployJasperServerComponent
};

module.exports = router;