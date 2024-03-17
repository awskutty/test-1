/****
 * Api_Name          : /Upload,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqAnalyticInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqRequest = require(modPath + 'request');
// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/getprojects', function (appReq, appResp) {
    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {

        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'getprojects-Analytics';
        objLogInfo.ACTION = 'getprojects';

        var strHeader = appReq.headers

        try {

            var clientId = appReq.body.CLIENT_ID;
            var tcpUrl = appReq.body.TCP_URL;
            var program_source = appReq.body.PROGRAM_SOURCE;
            var orchestration_type = appReq.body.ORCHESTRATION_TYPE;
            var type_of_program = appReq.body.STREAM_TYPE;
            reqAnalyticInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {


                // var insert_programs = "INSERT INTO programs( program_source, orchestration_type, ide_project_name, ide_project_type, ide_project_version, ide_project_code, created_by, created_date, modified_by, modified_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                // var update_programs = "update programs set ide_project_version=? where ide_project_name=?";
                try {
                    if (tcpUrl != undefined) {
                        reqRequest.post(tcpUrl, { formData: { CLIENT_ID: clientId } }, (err, httpResponse, body) => {
                            if (err) {
                                _SendResponse({}, 'Errcode', 'No Build Project Available', err, null)

                            }
                            else {
                                var TCPIDEPROJECTS = JSON.parse(body);
                                reqAnalyticInstance.GetTableFromTranDB(pSession, 'PROGRAMS', {}, objLogInfo, function callbackTablePrograms(pProjects, pError) {
                                    try {
                                        var PGIDEPROJECTS = pProjects
                                        //for (var i = 0; i < TCPIDEPROJECTS.length; i++) {
                                        var i = 0;
                                        if (i < TCPIDEPROJECTS.length) {
                                            tcpIdeProjLoop(TCPIDEPROJECTS[i]);
                                        } else {
                                            lastSelect();
                                        }
                                        function tcpIdeProjLoop(tcpIdeProj) {
                                            i++;
                                            var resultInfo = PGIDEPROJECTS.filter((value) => {
                                                if (tcpIdeProj.PROJNAME == value.ide_project_name) {
                                                    return value;
                                                }
                                            });
                                            if (resultInfo != undefined && resultInfo.length > 0) {
                                                var project_version = JSON.parse(resultInfo[0].ide_project_version);
                                                if (project_version.Version != tcpIdeProj.VERSION) {
                                                    var versionInfo = {};
                                                    versionInfo.Version = tcpIdeProj.VERSION.toString();
                                                    if (tcpIdeProj.KAFKA_TYPE != undefined) {
                                                        versionInfo.kafka_type = tcpIdeProj.KAFKA_TYPE;
                                                    }
                                                    reqAnalyticInstance.UpdateTranDBWithAudit(pSession, 'PROGRAMS', { IDE_PROJECT_VERSION: JSON.stringify(versionInfo) }, { IDE_PROJECT_NAME: tcpIdeProj.PROJNAME }, objLogInfo, function callbackUpdatePrograms(pError, pResult) {
                                                        try {
                                                            reqAnalyticInstance.GetTableFromTranDB(pSession, 'PROGRAMS', {}, objLogInfo, function callbackTablePrograms(pProjects, pError) {
                                                                try {
                                                                    var PGIDEPROJECTS = pProjects.rows;
                                                                    if (pError) {
                                                                        _SendResponse({}, 'Errcode', 'Error Project Cant be Loaded', pError, null);
                                                                    } else {
                                                                        if (i < TCPIDEPROJECTS.length) {
                                                                            tcpIdeProjLoop(TCPIDEPROJECTS[i]);
                                                                        } else {
                                                                            lastSelect();
                                                                        }
                                                                    }
                                                                } catch (error) {
                                                                    _SendResponse({}, 'Errcode', 'Unable Load', error, null);
                                                                }
                                                            })
                                                        } catch (error) {
                                                            _SendResponse({}, 'Errcode', 'Unable Load', error, null);
                                                        }
                                                    })
                                                } else {
                                                    if (i < TCPIDEPROJECTS.length) {
                                                        tcpIdeProjLoop(TCPIDEPROJECTS[i]);
                                                    } else {
                                                        lastSelect();
                                                    }
                                                }
                                            } else {
                                                var versionInfo = {};
                                                versionInfo.Version = tcpIdeProj.VERSION.toString();
                                                console.log(versionInfo.Version);
                                                if (tcpIdeProj.KAFKA_TYPE != undefined) {
                                                    versionInfo.kafka_type = tcpIdeProj.KAFKA_TYPE;
                                                }
                                                reqAnalyticInstance.InsertTranDBWithAudit(pSession, 'PROGRAMS', [{
                                                    PROGRAM_SOURCE: program_source,
                                                    ORCHESTRATION_TYPE: orchestration_type,
                                                    IDE_PROJECT_NAME: tcpIdeProj.PROJNAME,
                                                    IDE_PROJECT_TYPE: tcpIdeProj.PROJTYPE,
                                                    IDE_PROJECT_VERSION: JSON.stringify(versionInfo),
                                                    IDE_PROJECT_CODE: tcpIdeProj.PROJCODE,
                                                    CREATED_BY: tcpIdeProj.CREATED_BY,
                                                    CREATED_DATE: tcpIdeProj.CREATED_DATE,
                                                    MODIFIED_BY: tcpIdeProj.CREATED_BY,
                                                    MODIFIED_DATE: tcpIdeProj.MODIFIED_DATE
                                                }], objLogInfo, function callbackInsertProgram(pResult, pError) {
                                                    try {
                                                        if (pError) {
                                                            _SendResponse({}, 'Errcode', 'Unable To Insert To Table', pError, null);
                                                        } else {
                                                            if (i < TCPIDEPROJECTS.length) {
                                                                tcpIdeProjLoop(TCPIDEPROJECTS[i]);
                                                            } else {
                                                                lastSelect();
                                                            }
                                                        }
                                                    } catch (error) {
                                                        _SendResponse({}, 'Errcode', 'Unable Load', error, null);
                                                    }
                                                });
                                            }
                                        }
                                        //}

                                        function lastSelect() {
                                            reqAnalyticInstance.GetTableFromTranDB(pSession, 'PROGRAMS', {}, objLogInfo, function callbackTablePrograms(pProjects, pError) {
                                                try {
                                                    if (pError) {
                                                        _SendResponse({}, 'Errcode', 'Unable To Get Data', pError, null);
                                                    }
                                                    //var FULLPROJECT = pProjects;
                                                    var FULLPROJECT = [];
                                                    var withKafkaType = [];
                                                    var withOutKafkaType = [];
                                                    for (var i = 0; i < pProjects.length; i++) {
                                                        var curProj = pProjects[i];
                                                        curProj.CLIENT_ID=clientId
                                                        curProj.APC_CODE="PYTHON_3.6.4"
                                                        if (JSON.parse(curProj.ide_project_version).kafka_type) {
                                                            withKafkaType.push(curProj);
                                                        } else {
                                                            withOutKafkaType.push(curProj);
                                                        }
                                                    }
                                                    if (type_of_program == 'stream') {
                                                        FULLPROJECT = withKafkaType;
                                                    } else  {
                                                        FULLPROJECT = withOutKafkaType;
                                                    }
                                                    _SendResponse({ resultdata: FULLPROJECT}, null, '', null, null);
                                                } catch (error) {
                                                    _SendResponse({}, 'Errcode', 'Unable Load', error, null);
                                                }
                                            })
                                        }
                                    }

                                    catch (error) {
                                        _SendResponse({}, 'Errcode', 'Unable Load', error, null);
                                    }

                                })
                            }

                        })
                    }
                } catch (error) {
                    _SendResponse({}, 'Errcode', 'Unable Load', error, null);
                }

            })
        } catch (error) {
            _SendResponse({}, 'Errcode', 'Unable Load', pError, null);
        }
        // To send the app response
        function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
            var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
            var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
            return reqInstanceHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
        }
        function errorHandler(errcode, message) {
            console.log(errcode, message);
            reqLogWriter.TraceError(objLogInfo, message, errcode);
        }

    })


});
module.exports = router;