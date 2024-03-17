
/*
@Api_Name           : userpreferedsetting,
@Description        : To save user prefered settings
@Last_Error_code    : ERR-AUT-
*/

var reqExpress = require('express');
var router = reqExpress.Router();
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
router.post('/SaveUserPreferences', function (appRequest, appResponse) {
    try {
        var header = appRequest.headers;
        var params = appRequest.body.PARAMS;
        var tableName = 'USER_PREFERENCE';
        var serviceName = 'SaveUserPreferences';
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                reqDBInstance.GetFXDBConnection(header, 'clt_cas', objLogInfo, function (pCltSessions) {

                    mainfunction();

                    async function mainfunction() {
                        try {
                            _PrintInfo('main function called.');
                            var cond = {
                                U_ID: objLogInfo.USER_ID,
                                APP_ID: objLogInfo.APP_ID,
                            };

                            var rowObj = {
                                CATEGORY: params.CATEGORY,
                                SETUP_JSON: JSON.stringify(params.SETUP_JSON)
                            };
                            var userpreferencRows = await GetUserpreferedsettings(cond);

                            var userprefereDtl = [];
                            for (var i = 0; i < userpreferencRows.length; i++) {
                                if (userpreferencRows[i].category == 'DEFAULT_PAGE') {
                                    var parsedJson = JSON.parse(userpreferencRows[i].setup_json);
                                    if (parsedJson.appur_id == objSessionInfo.APP_USER_ROLES) {
                                        userprefereDtl.push(userpreferencRows[i]);
                                    }
                                } else {
                                    userprefereDtl.push(userpreferencRows[i]);
                                }
                            }

                            if (userprefereDtl.length) {
                                setupJson = JSON.parse(userprefereDtl[0].setup_json);
                                var updateCond = {
                                    up_id: userprefereDtl[0].up_id
                                };
                                updatesetings(updateCond, rowObj);
                            } else {
                                rowObj.U_ID = objLogInfo.USER_ID;
                                rowObj.TENANT_ID = objLogInfo.TENANT_ID;
                                rowObj.APP_ID = objLogInfo.APP_ID;
                                insertUserPreference(rowObj);
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-19105', 'Exception occured mainfunction', error);
                        }
                    }

                    function GetUserpreferedsettings(pCond) {
                        return new Promise((resolve, reject) => {
                            try {
                                _PrintInfo('Check user preference settings available for user.');
                                reqDBInstance.GetTableFromFXDB(pCltSessions, tableName, [], pCond, objLogInfo, function (pErr, pResult) {
                                    if (pErr) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-14726', 'Error occured get the value from user preference ', pErr);
                                    } else {
                                        resolve(pResult.rows);
                                    }
                                });
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-14725', 'Exception occured while GetUserpreferedsettings ', error);
                            }
                        });
                    }
                    function updatesetings(pCond, pRows) {
                        try {
                            pRows.modified_date = reqDateFormater.GetTenantCurrentDateTime(header, objLogInfo);
                            reqDBInstance.UpdateFXDB(pCltSessions, tableName, pRows, pCond, objLogInfo, function (pErr, pRes) {
                                if (pErr) {
                                    _PrintInfo('Error occured ' + pErr);
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-14721', 'Error occured while updatesetings ', pErr);
                                } else {
                                    _PrintInfo('Update success');
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, 'SUCCESS', objLogInfo, '', '', '');
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-19102', 'Exception occured updatesetings', error);
                        }
                    }

                    function insertUserPreference(pRowobj) {
                        try {
                            _PrintInfo('Going to insert the data into user preference table');
                            pRowobj.created_date = reqDateFormater.GetTenantCurrentDateTime(header, objLogInfo);
                            var InsertRowarr = [];
                            InsertRowarr.push(pRowobj);
                            reqDBInstance.InsertFXDB(pCltSessions, tableName, InsertRowarr, objLogInfo, function (pErr, pResult) {
                                if (pErr) {
                                    _PrintInfo('Error occured ' + pErr);
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-14722', 'Error occured insert into user preference ', pErr);
                                } else {
                                    _PrintInfo('Insert success');
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, 'SUCCESS', objLogInfo, '', '', '');
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-19106', 'Exception occured insertUserPreference', error);
                        }
                    }

                    function _PrintInfo(pMessage) {
                        reqInstanceHelper.PrintInfo(serviceName, pMessage, objLogInfo);
                    }
                });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-14723', 'Exception occured  ', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-14724', 'Exception occured  ', error);
    }
});
module.exports = router;
