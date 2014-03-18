/**
 * Created by Alain Dechorgnat on 12/13/13.
 */

var StatusApp = angular.module('StatusApp', ['D3Directives','ngCookies','ngAnimate'])
    .filter('bytes', funcBytesFilter)
    .filter('duration', funcDurationFilter);

StatusApp.controller("statusCtrl", function ($scope, $http , $cookieStore) {
    var apiURL = '/ceph-rest-api/';
    $scope.journal = [];
    $scope.osdControl =0;
    //refresh data every x seconds

    $scope.viewControlPanel = false;
    $scope.viewMonitorModule = testAndSetCookie('viewMonitorModule',true);
    $scope.viewCapacityModule = testAndSetCookie('viewCapacityModule',true);
    $scope.viewPoolModule = testAndSetCookie('viewPoolModule',true);
    $scope.viewOsdModule = testAndSetCookie('viewOsdModule',true);
    $scope.viewPgStatusModule = testAndSetCookie('viewPgStatusModule',true);
    $scope.viewMdsModule = testAndSetCookie('viewMdsModule',true);

    function testAndSetCookie(param,defaultValue) {
        var value = $cookieStore.get(param);
        if (typeof value ==="undefined") {
            $cookieStore.put(param,defaultValue);
            value = defaultValue;
        }
        return value;
    }

    refreshData();
    setInterval(function () {
        refreshData()
    }, 3 * 1000);

    function refreshData() {
        //console.log("refreshing data...");
        $scope.date = new Date();
        $http({method: "get", url: apiURL + "status.json"})
            .success(function (data) {
                $scope.pgmap = data.output.pgmap;
                $scope.mdsmap = data.output.mdsmap;
                $scope.percentUsed = $scope.pgmap.bytes_used / $scope.pgmap.bytes_total;
                $scope.pgsByState = $scope.pgmap.pgs_by_state;

                $scope.health = {};
                $scope.health.severity = data.output.health.overall_status;
                if (data.output.health.summary[0])
                    $scope.health.summary = data.output.health.summary[0].summary;
                else if (data.output.health.detail[0])
                    $scope.health.summary = data.output.health.detail[0];
                else
                    $scope.health.summary = "OK";

                historise();

                $scope.mons = data.output.monmap.mons;

                for (var i = 0; i < $scope.mons.length; i++) {
                    var mon = $scope.mons[i];
                    mon.health = "HEALTH_UNKNOWN"; // default for styling purpose
                    mon.quorum = "out";          // default for styling purpose
                    for (var j = 0; j < data.output.quorum_names.length; j++) {
                        if (mon.name == data.output.quorum_names[j]) {
                            mon.quorum = "in";
                            break
                        }
                    }
                    if (data.output.health.timechecks.mons) //not always defined
                        for (var j = 0; j < data.output.health.timechecks.mons.length; j++) {
                            mon2 = data.output.health.timechecks.mons[j];
                            if (mon.name == mon2.name) {
                                for (key in mon2) mon[key] = mon2[key];
                                break
                            }
                        }
                    for (var j = 0; j < data.output.health.health.health_services[0].mons.length; j++) {
                        mon2 = data.output.health.health.health_services[0].mons[j];
                        if (mon.name == mon2.name) {
                            for (key in mon2) {
                                if (( key == "health") && (mon[key]+"" != "undefined"))
                                    mon[key] =healthCompare(mon[key],mon2[key]);
                                else
                                    mon[key] = mon2[key];
                            }
                            break
                        }
                    }
                }

                function healthCompare(h1,h2){
                    if ((h1 == "HEALTH_ERROR")||(h2 == "HEALTH_ERROR")) return "HEALTH_ERROR";
                    if ((h1 == "HEALTH_WARN")||(h2 == "HEALTH_WARN")) return "HEALTH_WARN";
                    return h1;
                }

                var osdmap = data.output.osdmap.osdmap;
                $scope.osdsUp = osdmap.num_up_osds;
                $scope.osdsIn = parseInt(osdmap.num_in_osds);
                $scope.osdsOut = osdmap.num_osds - osdmap.num_in_osds;
                $scope.osdsDown = $scope.osdsIn - $scope.osdsUp + $scope.osdsOut;
                $scope.osdsNearFull = osdmap.nearfull ==  "true" ?1:0;
                $scope.osdsFull = osdmap.full ==  "true" ?1:0;
            })
            .error(function (data) {
                $scope.health = {};
                $scope.health.severity = "HEALTH_WARN";
                $scope.health.summary = "Status not available";
            });
    }

    $scope.badgeClass = function (type, count) {
        if ((count == 0) || (count + "" == "undefined"))
            return "health_status_HEALTH_UNKNOWN mybadge";
        else
            return "health_status_HEALTH_" + type + " mybadge";
    }

    $scope.showModule = function(module,view){
        $cookieStore.put(module,view);
        $scope[module]=view;
    }

    function historise() {
        if ($scope.last_health_summary + "" == "undefined") {
            $scope.last_health_summary = $scope.health.summary;
            $scope.journal.push({"date": new Date(), "summary": $scope.health.summary});
            return;
        }
        if ($scope.last_health_summary != $scope.health.summary) {
            $scope.journal.push({"date": new Date(), "summary": $scope.health.summary});
            $scope.last_health_summary = $scope.health.summary;
        }
    }

});

