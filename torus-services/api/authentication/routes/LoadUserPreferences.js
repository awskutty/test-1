
/*
@Api_Name           : Load User preference,
@Description        : To save user prefered settings
@Last_Error_code    : ERR-AUT-
*/

var reqExpress = require('express');
var router = reqExpress.Router();
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqDateFormat = require('dateformat');
var reqmoment = require('moment');
router.post('/LoadUserPreference', function (appRequest, appResponse) {
    try {
        var header = appRequest.headers;
        var params = appRequest.body.PARAMS;
        var serviceName = 'LoadUserPreference';
        var numberofdays = 10;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                reqDBInstance.GetFXDBConnection(header, 'clt_cas', objLogInfo, function (pCltSessions) {

                    mainfunction();

                    async function mainfunction() {
                        try {

                            _PrintInfo(`mainfunction executing`);

                            var Resobject = {};
                            var dateValue = '';
                            var adtecond = '';
                            if (pCltSessions.DBConn.DBType == 'pg') {
                                dateValue = reqmoment().subtract(numberofdays, 'd').format("YYYY-MM-DD");
                                adtecond = `to_date(to_char(created_date,'yyyy-mm-dd'),'yyyy-mm-dd') >='${dateValue}'`;
                            } else {
                                dateValue = reqmoment().subtract(numberofdays, 'd').format("DD-MMM-YYYY");
                                adtecond = `to_date(to_char(created_date,'DD-MON-YY'),'DD-MON-YY') >='${dateValue}'`;
                            }

                            var menuAccesssdata = await GetDataFromTable('USER_MENU_ACCESS_LOG', 'umal_id', `AND APPUR_ID ='${objSessionInfo.APP_USER_ROLES}' AND ${adtecond}`);
                            var HstData = [];
                            if (menuAccesssdata.length) {
                                _PrintInfo(`User menu access log data available`);
                                HstData = prepareJsondata('USER_MENU_ACCESS_LOG', menuAccesssdata);
                            }
                            Resobject.History = HstData;
                            var favScreen = await GetDataFromTable('USER_FAVORITE_MENU', 'ufm_id', `AND APPUR_ID ='${objSessionInfo.APP_USER_ROLES}'`);
                            var FavscrnData = [];
                            if (favScreen.length) {
                                _PrintInfo(`User favorite data available`);
                                FavscrnData = prepareJsondata('USER_FAVORITE_MENU', favScreen);
                            }
                            Resobject.Favorite = FavscrnData;
                            var userPreferencescrn = await GetDataFromTable('USER_PREFERENCE', 'up_id', '');
                            var perefscrnData = [];
                            if (userPreferencescrn.length) {
                                _PrintInfo(`User preference data available`);
                                perefscrnData = preparePreferenceJsondata(userPreferencescrn);
                            }
                            Resobject.user_preference = perefscrnData;
                            reqInstanceHelper.SendResponse(serviceName, appResponse, Resobject, objLogInfo);

                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-19205', 'Error in query execution ', pErr);
                        }
                    }

                    function GetDataFromTable(pTableName, pOrderby, pWhereCond) {
                        return new Promise((resolve, reject) => {
                            try {
                                _PrintInfo(`Getting details from ${pTableName}`);
                                // var pcond = { U_ID: objLogInfo.USER_ID, APP_ID: objLogInfo.APP_ID };
                                var qry = `select * from ${pTableName} where U_ID ='${objLogInfo.USER_ID}' and app_id='${objLogInfo.APP_ID}' ${pWhereCond} order by ${pOrderby} desc `;
                                _PrintInfo(`qry is ${qry}`);
                                // reqDBInstance.GetTableFromFXDB(pCltSessions, pTableName, [], pcond, objLogInfo, function (pErr, pResult) {
                                reqDBInstance.ExecuteQuery(pCltSessions, qry, objLogInfo, function (pErr, pResult) {
                                    if (pErr) {
                                        _PrintInfo(`Error occured ${pErr}`);
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-19204', 'Error in query execution ', pErr);
                                    } else {
                                        resolve(pResult.rows);
                                    }
                                });
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-19203', 'Error in selectFxData', error);
                            }
                        });
                    }

                    function prepareJsondata(pTableName, pData) {
                        try {
                            _PrintInfo(`prepareJsondata function called `);
                            var arrHstMenu = [];
                            for (var i = 0; i < pData.length; i++) {
                                var objHstmenu = {};
                                objHstmenu.app_id = pData[i].app_id;
                                var parsedMenu = '';
                                parsedMenu = JSON.parse(pData[i].menu_info);
                                objHstmenu.menu_item = parsedMenu.menuItem;
                                objHstmenu.menu_group = parsedMenu.menuGroup;
                                objHstmenu.menu_module = parsedMenu.module;
                                objHstmenu.router_link = parsedMenu.RouterLink;
                                objHstmenu.accessed_date = reqDateFormat(pData[i].created_date, 'dd-mmm-yyyy');
                                objHstmenu.accessed_time = reqDateFormat(pData[i].created_date, 'h:MM TT');
                                objHstmenu.accessed_full_date = pData[i].created_date;
                                arrHstMenu.push(objHstmenu);
                            }
                            return arrHstMenu;
                        } catch (error) {
                            _PrintInfo(`Exeption occured while executing prepareJsondata ${error}`);
                            reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-19202', 'Exception occured while executing prepareJsondata', error);
                        }

                    }
                    function preparePreferenceJsondata(pData) {
                        try {
                            _PrintInfo(`preparePreferenceJsondata function called `);
                            var arpreference = [];
                            for (var i = 0; i < pData.length; i++) {
                                var parseddata = JSON.parse(pData[i].setup_json);
                                if (pData[i].category == 'DEFAULT_PAGE') {
                                    if (parseddata.appur_id != objSessionInfo.APP_USER_ROLES) {
                                        continue;
                                    }
                                }
                                var objpreference = {};
                                objpreference.app_id = pData[i].app_id;
                                objpreference.category = pData[i].category;
                                objpreference.setup_json = parseddata;
                                objpreference.accessed_date = reqDateFormat(pData[i].created_date, 'dd-mmm-yyyy');
                                objpreference.accessed_time = reqDateFormat(pData[i].created_date, 'h:MM TT');
                                arpreference.push(objpreference);
                            }
                            return arpreference;
                        } catch (error) {
                            _PrintInfo(`exeption occured while executing preparePreferenceJsondata ${error}`);
                            reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-19201', 'Exception occured', error);
                        }
                    }


                    function _PrintInfo(pMessage) {
                        reqInstanceHelper.PrintInfo(serviceName, pMessage, objLogInfo);
                    }

                });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-17101', 'Exception occured', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-17101', 'Exception occured', error);
    }
});

module.exports = router;