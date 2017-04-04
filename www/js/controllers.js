angular.module('starter.controllers', [])

.controller('MapCtrl', function($scope, $rootScope, $ionicPlatform, $ionicPopup, $cordovaBeacon) {
	
	$scope.settings = {
		notifications: true
	  };
	
	$scope.updateNotif = function(){
	}

	var positioningMode = 1; // 1: exact dominant beacon, 2: trilaterations
	
	var platform = 'Unknown';
	var deviceId = 'NA';
	
	// to show the notification only once
	var firstVisit = {5178:1, 3001:1, 3002:1, 3003:1, 3004:1, 3005:1, 3006:1, 3007:1, 3008:1, 3009:1, 3010:1, 3011:1, 3012:1, 3013:1, 2014:1, 3015:1}; 
	var dominatHistory = []; // keep the last three dominant beacons
	
	var startimg="img/floor1_2.svg";
    $scope.image=startimg;
    $scope.x = 100;
	$scope.y = 100;
	$scope.minorb = 0;
	
	// coordinates of the ibeacons on the map
	var points = {};
	points[3001] = { x:100, y:200 };
	points[3002] = { x:145, y:145 };

	points[3004] = { x:50, y:140 };
	points[3005] = { x:190, y:145 };
	points[3006] = { x:145, y:225 };
	points[3007] = { x:80, y:273 };
	points[3008] = { x:145, y:185 };
	points[3009] = { x:190, y:185 };
	points[3010] = { x:240, y:145 };
	points[3011] = { x:240, y:185 };
	points[3012] = { x:145, y:273 };
	points[3013] = { x:190, y:273 };
	points[3014] = { x:240, y:273 };
	points[3015] = { x:290, y:273 };
	// connectors for better showing the routes in the map; They are not iBeacons!
	points[101] = { x:140, y:200 };
	points[102] = { x: 80, y:225 };
	points[103] = { x: 215, y:200 };
	points[104] = { x: 215, y:260 };
	points[105] = {x: 170, y: 240 };
		
	$scope.rssiHistory = {};
	$scope.allRssiHistory = {};
	var historyCount = 5;
		
	document.addEventListener("deviceready", onDeviceReady, false);
	function onDeviceReady() {
	    platform = device.platform;
	    deviceId = device.uuid;
	}

	
    $ionicPlatform.ready(function() {
		$cordovaBeacon.requestWhenInUseAuthorization();
		
		$rootScope.$on("$cordovaBeacon:didRangeBeaconsInRegion",function(event, pluginResult) {
			var minor;
			var rssi;
			var distance;
			var dominantBeacon;
			var beaconSignals = []
			var rssiValues = {}
			for (var i = 0; i < pluginResult.beacons.length; i++) {				
				minor = pluginResult.beacons[i].minor;
				rssi = pluginResult.beacons[i].rssi;
				distance = pluginResult.beacons[i].accuracy;
				var avgRssi = rssi;
				addRssiHistory($scope.allRssiHistory, minor, rssi);
				if(rssi != 0)
					addRssiHistory($scope.rssiHistory, minor, rssi);
				if(rssi == 0 && !areAllRssiZero(minor))
					avgRssi = getAvgRssi(minor);
				
				beaconSignals.push( {"minor" : minor, "rssi" : avgRssi, "origRssi": rssi, "dist" : distance });
				rssiValues[minor] = avgRssi;
			}
			
			beaconSignals.sort(function(a,b) {
				if( a.rssi == 0 || b.rssi == 0) // put zeros to the end of list
					return a.rssi-b.rssi;
				else
					return b.rssi - a.rssi; // Descending order
			});
			
			if(beaconSignals.length > 0){				
				dominantBeacon = beaconSignals[0]['minor'];
				if(dominatHistory.length < 3)
					dominatHistory.splice(0, 0, dominantBeacon);
				else{
					dominatHistory.splice(-1, 1); // remove the old item
					dominatHistory.splice(0, 0, dominantBeacon); // insert as the first item
				}
			}
			
			
			dominantBeacon = getMajority(dominatHistory);
			
			$scope.minorb = dominantBeacon;
			if($scope.settings.notifications && dominantBeacon!= null){
				// check the beacon has not been visited and its rssi is big enough.
				if(firstVisit[dominantBeacon]==1 && rssiValues[dominantBeacon]>-75 && rssiValues[dominantBeacon]<0 ){					
					firstVisit[dominantBeacon] = 0;					
					$scope.getBeaconMessage(dominantBeacon);
				}
			}

			if(positioningMode == 1 && dominantBeacon != null){
				$scope.minorb = dominantBeacon;
				$scope.x = points[dominantBeacon]['x'];
				$scope.y = points[dominantBeacon]['y'];
			}
			else if(beaconSignals.length > 2){
				var m1 = beaconSignals[0]['minor'];
				var m2 = beaconSignals[1]['minor'];
				var m3 = beaconSignals[2]['minor'];
				
				$scope.minorb = m1;
				
				var x1 = points[m1]['x'];
				var y1 = points[m1]['y'];
				
				var x2 = points[m2]['x'];
				var y2 = points[m2]['y'];
				
				var x3 = points[m3]['x'];
				var y3 = points[m3]['y'];
				
				var d1 = getDistance(beaconSignals[0]['rssi']);
				var d2 = getDistance(beaconSignals[1]['rssi']);
				var d3 = getDistance(beaconSignals[2]['rssi']);
				
				if(d1>0 && d2>0 && d3>0){
				
					var A = (x1*x1) + (y1*y1) - (d1*d1);
					var B = (x2*x2) + (y2*y2) - (d2*d2);
					var C = (x3*x3) + (y3*y3) - (d3*d3);
					
					var X32 = x3 - x2;
					var X13 = x1 - x3;
					var X21 = x2 - x1;
					var Y32 = y3 - y2;
					var Y13 = y1 - y3;
					var Y21 = y2 - y1;
					
					// based on the formula from http://cdn.intechweb.org/pdfs/13525.pdf
					var x = ( (A*Y32) + (B*Y13) + (C*Y21) )/(2*( (x1*Y32) + (x2*Y13) + (x3*Y21) ));
					var y = ( (A*X32) + (B*X13) + (C*X21) )/(2*( (y1*X32) + (y2*X13) + (y3*X21) ));
					
					x = Math.round(x);
					y = Math.round(y);
					
					if(x== -Infinity || isNaN(x) || y == -Infinity || isNaN(y)){
						$scope.x = points[dominantBeacon]['x'];
						$scope.y = points[dominantBeacon]['y'];
					}
					else {
						$scope.x = x;
						$scope.y = y;
					}
				} 
				
			} 

			else if(beaconSignals.length > 0){			
				$scope.x = points[dominantBeacon]['x'];
				$scope.y = points[dominantBeacon]['y'];
			}
			
			$scope.$apply();
		});
		// This should be changed based on the UUID of your devices
		$cordovaBeacon.startRangingBeaconsInRegion($cordovaBeacon.createBeaconRegion("WaldoBeacon", "FDA50693-A4E2-4FB1-AFCF-C6EB07647825"));
		var watchID = navigator.compass.watchHeading(onCompassSuccess, onCompassError, compassOptions);

    });
    
    function getDistance(rssi){
    	var A0 = -55; // this is calibrated power
    	var n = 3.3; // this is environmental constant, found by analysing data
    	if(rssi == 0)
    		return -1;
    	else {
    		var p = (rssi - A0)/(-10*n);
    		d = Math.pow(10, p);
    		d = d.toFixed(1);
    		return d;
    	}
    		
    }

    function getMax(signalData){
    	var maxRssi = -255;
    	var minor = 0;
    	for(var minorKey in signalData){
    		if(signalData[minorKey] != 0 && signalData[minorKey] > maxRssi)
    			{
    				maxRssi = signalData[minorKey];
    				minor = minorKey;
    			}
    	}
    	return minor;
    	
    }
    
    function getMajority(items){ // for three items
    	
    	if(items[0] == items[1] || items[0] == items[2])
    		return items[0];
    	else if (items[1] == items[2]) 
    		return items[1];
    	else //there is no majority; pick the newest one.
    		return items[0];
    }
    
    function getBeaconIndex(beacon, beaconList){
    	for(var item in beaconList){
    		
    	}
    }
    
	$scope.getBeaconMessage = function(minorVal) {
		data = {};
		data[3001] = [{"Minor":3001, "Message":"Welcome!", "template":"text", "enabled":1, "url":""},
		              {"Minor":3001, "Message":"Event here!", "template":"event", "date":'03-27-2017', "enabled":1, "url":""},
		              ];
		data[3004] = [{"Minor":3004, "Message":"Need more info?!", "template":"text", "type":'URL', "enabled":1, "url":"http://wwww.wmich.edu/library"}];
						
		handleBeaconMsg(data[minorVal]);
	}
	
	function handleBeaconMsg(response){
		if(response.length > 0){
			var i;
			var msgList = [];
			for (i=0; i < response.length; i++){
				if(response[i]['enabled']==1){
					if(response[i]['template']=='text'){
						if(response[i]['type']=='URL'){
							showConfirm(response[i]['Message'], response[i]['url']);			
						}
						else
							msgList.push(response[i]['Message']);
					}
					else if (response[i]['template']=='event'){
						var date = response[i]['date'];
						var now = getDate();
						if(now <= date){
							var msg = 'There will be "' + response[i]['notes'] + '" at this place on ' + date;
							msgList.push(msg);
						}
					}
				}
			}
			if(msgList.length > 0)
				showAlerts(msgList);
		}
	}
	
	function showConfirm(msg, url) {
		   var confirmPopup = $ionicPopup.confirm({
		     title: msg,
		     template: 'open the page to get more information?'
		   });

		   confirmPopup.then(function(res) {
		     if(res) {
		    	 window.open(url, '_system', 'location=yes');
		     } else {
		       //alert('error');
		     }
		   });
	};
	
	function showAlerts(alertMsgs){
		  $scope.data = alertMsgs;

		  // An elaborate, custom popup
		  var myPopup = $ionicPopup.show({
			template: '<div class="list"> <div class="item item-text-wrap" ng-repeat="msg in data"><div>{{msg}}</div></div> </div>',
		    title: 'Notifications',
		    subTitle: '(Events and Alerts)',
		    scope: $scope,
		    buttons: [
		      //{ text: 'Cancel' },
		      {
		        text: '<b>Ok</b>',
		        type: 'button-positive',
		      }
		    ]
		  });

	}
	
	function getDate(){
		var currentTime= new Date();
		var hours = currentTime.getHours();
		if (hours<10){
			hours = '0'+hours;
		}
		var minutes = currentTime.getMinutes();
		if (minutes<10){
			minutes = '0'+minutes;
		}
		var seconds = currentTime.getSeconds();
		if (seconds<10){
			seconds = '0'+seconds;
		}
		var month = currentTime.getMonth() + 1;
		if(month <10)
			month = '0' + month;
		var day = currentTime.getDate();
		if(day < 10)
			day = '0' + day;
		var year = currentTime.getFullYear();
		var t1 = hours +":"+minutes+":"+seconds;
		var d = year+"-"+month+"-"+day;
		var dateTime= d+" "+t1;

		return  dateTime;
	}
	
	$scope.pathVisibility = 'hidden';

	// building the structure of paths in our indoor building by defining a graph
	var map = [
	  {head: 3004, tail: 3001, dist: 1},
	  
	  {head: 3001, tail: 101, dist: 1},
	  {head: 101, tail: 3006, dist: 1},
	  {head: 101, tail: 3008, dist: 1},
	  {head: 101, tail: 103, dist: 1},
	  {head: 3001, tail: 102, dist: 1},
	  {head: 102, tail: 3007, dist: 1},
	  {head: 3008, tail: 3002, dist: 1},
	  {head: 3008, tail: 3009, dist: 1},
	  {head: 3002, tail: 3010, dist: 1},
	  {head: 3009, tail: 3011, dist: 1},
	  {head: 3009, tail: 103, dist: 1},
	  {head: 3011, tail: 103, dist: 1},
	  {head: 3011, tail: 3010, dist: 1},
	  {head: 103, tail: 104, dist: 2.5},
	  {head: 104, tail: 3013, dist: 1},
	  {head: 104, tail: 3014, dist: 1},
	  {head: 3006, tail: 3012, dist: 1},
	  {head: 3006, tail: 105, dist: 1},
	  {head: 3012, tail: 3007, dist: 1},
	  {head: 3012, tail: 105, dist: 1},
	  {head: 3012, tail: 3013, dist: 1},
	  {head: 3013, tail: 3014, dist: 1},
	  {head: 3014, tail: 3015, dist: 1}
	];
		
    graph = new Graph(map, true);
	
    // defining oints of interest for navigation
	$scope.destPoints = [{tag:0, name:""},
	                     {tag:3001, name:"Information Desk"},
	                     {tag:3004, name:"IT Services"},
	                     {tag:3007, name:"Events [Blue] Zone"},
	                     {tag:3008, name:"Popular Reading"},
	                     {tag:105, name:"Reference Desk"},
	                     {tag:3015, name:"Writing Center"}                     
	                     ];
	$scope.pointB = $scope.destPoints[0];

	$scope.drawPath = function(){
		// draw a line path from A to B.
		var pointA = $scope.minorb;
		var beaconsPoints = graph.findShortestPath(pointA, $scope.pointB.tag);
		$scope.pathPoints = "";
		var i;
		for(i = 0; i < beaconsPoints.length; i++){
			var b = beaconsPoints[i];
			var y = points[b]['y'];
			var x = points[b]['x'];
			var p = x + ',' + y + ' ';
			$scope.pathPoints += p;
		}

		$scope.pathVisibility = 'visible';
		$scope.apply();
	};
	
	$scope.clearPath = function(){
		$scope.pathVisibility = 'hidden';
	}
	$scope.showBeaconsBtnTxt = "Show Beacons";
	$scope.showBeacons = function(){
		if($scope.beaconsVisibility == 'visible'){
			$scope.beaconsVisibility = 'hidden';
			$scope.showBeaconsBtnTxt = "Show Beacons";
		}
		else{
			$scope.beaconsVisibility = 'visible';
			$scope.showBeaconsBtnTxt = "Hide Beacons";
		}
		$scope.beaconAllPoints = "";
		for(var i in points){
			var b = points[i];
			if(i>3000)
				$scope.beaconAllPoints += b['x'] +',' + b['y'] + ' ';
		}
		
	}
	
	function addRssiHistory(table, beaconKey, rssi){
		var hist = table[beaconKey];
		
		if(!hist){
			hist = [];
			hist.push(rssi);				
		}
		else{
			if(hist.length < historyCount){
				hist.splice(0, 0, rssi);
			}
			else{
				hist.splice(-1, 1); // remove the old item
				hist.splice(0, 0, rssi); // insert as the first item
			}
			
		}
		table[beaconKey] = hist;
	}
	
	function getAvgRssi(beaconKey){
		var sum = 0;
		var hist = $scope.rssiHistory[beaconKey];
		if(hist){
			for(var i = 0; i < hist.length; i++)
				sum = sum + hist[i];
			if(hist.length != 0)
				return Math.round(sum / hist.length);
			else 
				return 0;
		}
		else 
			return 0;
	}
	
	function areAllRssiZero(beaconKey){
		var hist = $scope.allRssiHistory[beaconKey];
		var allZero = true;
		if(hist){
			for(var i = 0; i < hist.length; i++){
				if(hist[i] != 0){
					allZero = false;
					break;
				}
			}
		}
		return allZero;
	}
	
	function onCompassSuccess(heading) {
		$scope.degree = heading.magneticHeading;
	};

	function onCompassError(compassError) {
	    //alert('Compass error: ' + compassError.code);
	};

	var compassOptions = {
	    frequency: 100
	}; 

}) // end of controller

.controller('AccountCtrl', function($scope) {

});
