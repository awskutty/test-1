
/*
@Api_Name           : SaveUserAccessLog,
@Description        : To save user screen access and add favorites screen to the requested user
*/

var reqExpress = require('express');
var router = reqExpress.Router();
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
const { resolve } = require('path');
const { reject } = require('lodash');
var uuid = require('uuid');
router.post('/SaveUserAccessLog', function (appRequest, appResponse) {
    try {
        var header = appRequest.headers;
        var params = appRequest.body.PARAMS;
        var serviceName = 'SaveUserAccessLog';
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                reqDBInstance.GetFXDBConnection(header, 'clt_cas', objLogInfo, async function (pCltSessions) {


                    var csrfToken = await preparecsrftoken()

                    mainfunction();

                    async function mainfunction() {
                        _PrintInfo('main function called ');
                        var insertobj = {
                            U_ID: objLogInfo.USER_ID,
                            TENANT_ID: objLogInfo.TENANT_ID,
                            APP_ID: objLogInfo.APP_ID,
                            CREATED_DATE: reqDateFormater.GetTenantCurrentDateTime(header, objLogInfo),
                            APPUR_ID: objSessionInfo.APP_USER_ROLES,
                            created_by: objLogInfo.USER_ID,
                            MENU_INFO: JSON.stringify({
                                module: params.module,
                                menuGroup: params.menuGroup,
                                menuItem: params.menuItem,
                                RouterLink: params.RouterLink,
                                MenuDesc: params.MenuDesc
                            }),
                            MODULE_NAME: params.module,
                            MENU_GROUP: params.menuGroup,
                            MENU_ITEM: params.menuItem,
                            MENU_DESC: params.MenuDesc,
                            LOGIN_NAME: objLogInfo.LOGIN_NAME
                        };

                        var tableName = 'USER_MENU_ACCESS_LOG';
                        if (params.category.toUpperCase() == 'FAVORITES') {
                            _PrintInfo('add favorite called');
                            tableName = 'USER_FAVORITE_MENU';
                            insertobj.REFERENCE_KEY = `${params.module}>${params.menuGroup}>${params.menuItem}`;
                            _PrintInfo('user screen access log called');
                        }


                        var insertArr = [];
                        insertArr.push(insertobj);

                        InsertUseraccess(insertArr, tableName);

                    }

                    function InsertUseraccess(pinsertArr, ptableName) {
                        try {
                            _PrintInfo('Going to insert the value into beloging table');
                            reqDBInstance.InsertFXDB(pCltSessions, ptableName, pinsertArr, objLogInfo, function (pErr, pResult) {
                                if (pErr) {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-18305', 'Error occured ', pErr);
                                } else {
                                    _PrintInfo('Table insert success');
                                    var resobj = {};
                                    resobj.csrf = csrfToken;
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, resobj, objLogInfo, '', '', '', 'SUCCESS');
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-18306', 'Exception occured ', error);
                        }
                    }
                    async function preparecsrftoken() {
                        return new Promise((resolve, reject) => {
                            try {
                                // var token = `${objLogInfo.LOGIN_NAME}_${objLogInfo.USER_ID}_${params.MenuDesc.replaceAll(' ', '_')}_${Math.floor(Math.random() * new Date())}`
                                var token = uuid.v4();
                                reqRedisInstance.GetRedisConnectionwithIndex(2, async function (err, redission) {
                                    var sessionIDRedKey = 'SESSIONID-' + appRequest.headers['session-id']
                                    var redisvalue = await redission.GET(sessionIDRedKey);
                                    if (redisvalue) {
                                        var parsedValue = JSON.parse(redisvalue);
                                        parsedValue[1]['token'] = token;
                                        var ttl = await redission.TTL(sessionIDRedKey);
                                        reqRedisInstance.RedisInsert(redission, sessionIDRedKey, parsedValue, ttl);
                                    }
                                    resolve(token)
                                })

                            } catch (error) {
                                reject(error)
                            }
                        })
                    }
                    function _PrintInfo(pMessage) {
                        reqInstanceHelper.PrintInfo(serviceName, pMessage, objLogInfo);
                    }
                });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-18307', 'Exception occured ', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-18308', 'Exception occured ', error);
    }
});

module.exports = router;