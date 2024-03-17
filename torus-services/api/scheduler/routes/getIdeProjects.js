/****
 * Api_Name          : /Upload,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var express = require('express');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqRequest = require('request');
var router = express.Router();

// Host the login api
router.get('/getIdeProjects', function (appRequest, appResponse) {
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'getIdeProjects - SCHEDULER';
        objLogInfo.ACTION = 'getIdeProjects';
        var headers = appRequest.headers
        try {
            reqInstanceHelper.GetConfig('TCP_URL', function callbackGetKey(pConfig) {
                try {
                    getIdeProjects(JSON.parse(pConfig));
                } catch (error) {
                    _SendResponse({}, 'Errcode', 'Unable Load', error, null);
                }
            });
            function getIdeProjects(pConfig) {
                var clientId = objSessionInfo.CLIENT_ID;
                var tcpUrl = pConfig.url + "/GetIDEProjects";
                var program_source = "ide";
                var orchestration_type = "single";
                var type_of_program = "";
                reqTranDBInstance.GetTranDBConn(headers, false, function callbackGetTranDB(pSession) {
                    try {
                        if (tcpUrl != undefined) {
                            reqRequest.post(tcpUrl, { formData: { CLIENT_ID: clientId } }, (err, httpResponse, body) => {
                                try {
                                    if (err) {
                                        _SendResponse({}, 'Errcode', 'No Build Project Available', err, null)
                                    } else {
                                        var TCPIDEPROJECTS = JSON.parse(body);
                                        reqTranDBInstance.GetTableFromTranDB(pSession, 'PROGRAMS', {}, objLogInfo, function callbackTablePrograms(pProjects, pError) {
                                            try {
                                                var PGIDEPROJECTS = pProjects;
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
                                                            reqTranDBInstance.UpdateTranDB(pSession, 'PROGRAMS', { IDE_PROJECT_VERSION: JSON.stringify(versionInfo) }, { IDE_PROJECT_NAME: tcpIdeProj.PROJNAME }, objLogInfo, function callbackUpdatePrograms(pError, pResult) {
                                                                try {
                                                                    reqTranDBInstance.GetTableFromTranDB(pSession, 'PROGRAMS', {}, objLogInfo, function callbackTablePrograms(pProjects, pError) {
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
                                                                    });
                                                                } catch (error) {
                                                                    _SendResponse({}, 'Errcode', 'Unable Load', error, null);
                                                                }
                                                            });
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
                                                        reqTranDBInstance.InsertTranDB(pSession, 'PROGRAMS', [{
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
                                                function lastSelect() {
                                                    reqTranDBInstance.GetTableFromTranDB(pSession, 'PROGRAMS', {}, objLogInfo, function callbackTablePrograms(pProjects, pError) {
                                                        try {
                                                            if (pError) {
                                                                _SendResponse({}, 'Errcode', 'Unable To Get Data', pError, null);
                                                            }
                                                            var FULLPROJECT = [];
                                                            var withKafkaType = [];
                                                            var withOutKafkaType = [];
                                                            for (var i = 0; i < pProjects.length; i++) {
                                                                var curProj = pProjects[i];
                                                                curProj.CLIENT_ID = clientId
                                                                curProj.APC_CODE = "PYTHON_3.6.4"
                                                                if (JSON.parse(curProj.ide_project_version).kafka_type) {
                                                                    withKafkaType.push(curProj);
                                                                } else {
                                                                    withOutKafkaType.push(curProj);
                                                                }
                                                            }
                                                            if (type_of_program == 'stream') {
                                                                FULLPROJECT = withKafkaType;
                                                            } else {
                                                                FULLPROJECT = withOutKafkaType;
                                                            }
                                                            _SendResponse({ resultdata: FULLPROJECT }, null, '', null, null);
                                                        } catch (error) {
                                                            _SendResponse({}, 'Errcode', 'Unable Load', error, null);
                                                        }
                                                    });
                                                }
                                            }
                                            catch (error) {
                                                _SendResponse({}, 'Errcode', 'Unable Load', error, null);
                                            }
                                        });
                                    }
                                } catch (error) {
                                    _SendResponse({}, 'Errcode', 'Unable Load', error, null);
                                }
                            });
                        }
                    } catch (error) {
                        _SendResponse({}, 'Errcode', 'Unable Load', error, null);
                    }
                });
            }
        } catch (error) {
            _SendResponse({}, 'Errcode', 'Unable Load', pError, null);
        }
        // To send the app response
        function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
            var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
            var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
            return reqInstanceHelper.SendResponse('ChangeSearchTag', appResponse, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
        }
    });
});
module.exports = router;