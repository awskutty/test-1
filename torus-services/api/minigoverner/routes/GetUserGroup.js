/*
    @Api_Name : /GetUserList,
    @Description: To List out user groups
    @Last Error Code : 'ERR-MIN-'
*/

var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLinq = require("node-linq").LINQ;
router.post('/GetUserGroup', function (appRequest, appResponse) {
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        var pHeaders = appRequest.headers;
        var serviceName = 'GetUserGroup'
        reqDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackGetConn(pClient) {
            try {
                var pcond = {
                    tenant_id: objLogInfo.TENANT_ID
                }
                reqDBInstance.GetTableFromFXDB(pClient, 'USER_GROUP', [], pcond, objLogInfo, function (err, res) {
                    try {
                        if (err) {

                        } else {
                            // var ugRes = res.rows
                            getusergrpRoles(res.rows)

                            // reqInstanceHelper.SendResponse(serviceName, appResponse, res.rows, objLogInfo);
                        }
                    } catch (error) {

                    }
                })


                function getusergrpRoles(usergrp) {
                    try {
                        reqDBInstance.GetTableFromFXDB(pClient, 'USER_GROUP_APP_ROLES', [], pcond, objLogInfo, function (err, rolesRes) {
                            if (err) {

                            } else {
                                var usGroupRoleRes = rolesRes.rows;

                                var cond = {
                                    app_id: objLogInfo.APP_ID
                                }
                                reqDBInstance.GetTableFromFXDB(pClient, 'APP_ROLES', ['role_description', 'appr_id'], cond, objLogInfo, function (err, appRoleRows) {
                                    if (err) {

                                    } else {
                                        var appRole = appRoleRows.rows;

                                        var resArr = [];

                                        for (var i = 0; i < usergrp.length; i++) {
                                            var resobj = {}
                                            // resobj.ug_id = usergrp[i].ug_id;
                                            resobj.code = usergrp[i].code;
                                            resobj.description = usergrp[i].description;
                                            var curUsrGrpRes = usGroupRoleRes.filter(usrRole => {
                                                return usrRole.ug_code == usergrp[i].code
                                            })
                                            var strRoleDesc = ''
                                            var RoleIds = []
                                            for (var j = 0; j < curUsrGrpRes.length; j++) {
                                                var rolesRes = new reqLinq(appRole)
                                                    .Where(function (u) {
                                                        return u.appr_id == curUsrGrpRes[j].appr_id
                                                    }).ToArray();
                                                if (rolesRes.length) {
                                                    RoleIds.push(curUsrGrpRes[j].appr_id)
                                                    if (strRoleDesc) {
                                                        strRoleDesc = strRoleDesc + ',' + rolesRes[0].role_description;
                                                    } else {
                                                        strRoleDesc = rolesRes[0].role_description
                                                    }
                                                    resobj.RoleDesc = strRoleDesc;
                                                    resobj.role_id = RoleIds;
                                                } else {
                                                    resobj.RoleDesc = '';
                                                    resobj.role_id = [];
                                                }

                                            }
                                            resArr.push(resobj)
                                        }
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, resArr, objLogInfo);
                                    }
                                })

                            }
                        })

                    } catch (error) {

                    }
                }
            } catch (error) {

            }
        })
    })

})
module.exports = router;
//*******End of Serive*******//