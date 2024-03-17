
var modPath = '../../../../node_modules/';
var reqExpress = require('express');
var router = reqExpress.Router();
var reqLINQ = require(modPath + "node-linq").LINQ;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');

var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var strServiceName = 'LoadSystemTypes';

router.post('/LoadSystemTypes', function (appRequest, appResponse) {
    try {
        var objLogInfo = '';
        var objSessionInfo;
        var params = appRequest.body.PARAMS;
        if (params != '') {
            var ISSearch = params.IsSearch;
            var STDesc = params.STDesc
        }
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            try {
                var pHeader = appRequest.headers;
                objSessionInfo = sessionInfo;
                objLogInfo.HANDLER_CODE = 'LoadSystemTypes';
                objLogInfo.PROCESS = 'LoadSystemTypes-MiniGoverner';
                objLogInfo.ACTION_DESC = 'LoadSystemTypes';
                reqDBInstance.GetFXDBConnection(pHeader, 'clt_cas', objLogInfo, function (DBSession) {
                    try {
                        reqDBInstance.GetTableFromFXDB(DBSession, 'system_types', [], {
                            'client_id': objSessionInfo.CLIENT_ID
                        }, objLogInfo, function (pError, pResult) {
                            try {
                                if (pError) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error  Ocuured while getting system type ', pError, '', '');
                                } else {
                                    var rows = pResult.rows
                                    if (ISSearch != undefined) {
                                        rows = new reqLINQ(rows)
                                            .Where(function (item) {
                                                return item.st_description.toUpperCase().startsWith(STDesc.toUpperCase())
                                            }).ToArray();
                                    }
                                    var objST = {};
                                    var arrST = [];
                                    for (var i = 0; i < rows.length; i++) {
                                        var objsyStemType = {};
                                        objsyStemType.ST_CODE = rows[i].st_code;
                                        objsyStemType.ST_DESCRIPTION = rows[i].st_description;
                                        objsyStemType.ST_ID = rows[i].st_id;
                                        arrST.push(objsyStemType);
                                    }
                                    objST.SYSTEMTYPES = arrST;
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, objST, objLogInfo, '', '', '', '', '');
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while getting system type ', error, '', '');
                            }
                        })
                    } catch (error) {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while GetFXDBConnection ', error, '', '');
                    }
                })
            } catch (error) {
                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while AssignLogInfoDetail ', error, '', '');
            }
        })

    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while LoadSystemTypes ', error, '', '');
    }
});
module.exports = router