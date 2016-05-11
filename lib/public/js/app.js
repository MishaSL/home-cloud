var FMApp = angular.module('FMApp', ['ur.file']);

FMApp.controller('FileManagerCtr', ['$scope', '$http', '$location',
  function ($scope, $http, $location) {
    var FM = this;
    FM.curHashPath = '#/';          // hash in browser url
    FM.curFolderPath = '/';         // current relative folder path
    FM.curBreadCrumbPaths = [];     // items in breadcrumb list, for each level folder
    FM.curFiles = [];               // files in current folder

    FM.selecteAll = false;          // if select all files
    FM.selection = [];              // selected files
    FM.renameName = '';             // new name for rename action
    FM.uploadFile = null;           // will upload file
    FM.newFolderName = '';
    FM.successData = '__init__';
    FM.errorData = '__init__';


    var hash2paths = function (relPath) {
      var paths = [];
      var names = relPath.split('/');
      var path = '#/';
      paths.push({name: 'Home', path: path});
      for (var i=0; i<names.length; ++i) {
        var name = names[i];
        if (name) {
          path = path + name + '/';
          paths.push({name: name, path: path});
        }
      }
      return paths;
    };

    var humanSize = function (size) {
      var hz;
      if (size < 1024) hz = size + ' B';
      else if (size < 1024*1024) hz = (size/1024).toFixed(2) + ' KB';
      else if (size < 1024*1024*1024) hz = (size/1024/1024).toFixed(2) + ' MB';
      else hz = (size/1024/1024/1024).toFixed(2) + ' GB';
      return hz;
    };

    var humanTime = function (timestamp) {
      var t = new Date(timestamp);
      return t.toLocaleDateString() + ' ' + t.toLocaleTimeString();
    };

    var setCurFiles = function (relPath) {
      $http.get('api' + relPath)
        .success(function (data) {
          var files = data;
          files.forEach(function (file) {
            file.relPath = relPath + file.name;
            if (file.folder) file.relPath += '/';
            file.selected = false;
            file.humanSize = humanSize(file.size);
            file.humanTime = humanTime(file.mtime);
          });
          console.log(files);
          FM.curFiles = files;
        })
        .error(function (data, status) {
          alert('Error: ' + status + data);
        });
    };

    var handleHashChange = function (hash) {
      if (!hash) {
        return $location.path('/');
      }
      console.log('Hash change: ' + hash);
      var relPath = hash.slice(1);
      FM.curHashPath = hash;
      FM.curFolderPath = relPath;
      FM.curBreadCrumbPaths = hash2paths(relPath);
      setCurFiles(relPath);
    };

    $scope.$watch(function () {
      return location.hash;
    }, function (val) {
      handleHashChange(val);
    });

    // listening on file checkbox
    $scope.$watch('FM.curFiles|filter:{selected:true}', function (nv) {
      FM.selection = nv.map(function (file) {
        return file;
      });
    }, true);

    $scope.$watch('FM.selectAll', function (nv) {
      FM.curFiles.forEach(function (file) {
        file.selected = nv;
      });
    });

    $scope.$watch('FM.successData', function () {
      if (FM.successData === '__init__') return;
      $('#successAlert').show();
      $('#successAlert').fadeIn(3000);
      $('#successAlert').fadeOut(3000);
    });

    $scope.$watch('FM.errorData', function () {
      if (FM.errorData === '__init__') return;
      $('#errorAlert').show();
    });

    var httpRequest = function (method, url, params, data, config) {
      var conf = {
        method: method,
        url: url,
        params: params,
        data: data,
        timeout: 10000
      };
      for (var k in config) {
        if (config.hasOwnProperty(k)) {
          conf[k] = config[k];
        }
      }
      console.log('request url', url);
      $http(conf)
        .success(function (data) {
          FM.successData = data;
          handleHashChange(FM.curHashPath);
        })
        .error(function (data, status) {
          FM.errorData = ' ' + status + ': ' + data;
        });
    };

    var downloadFile = function (file) {
      window.open('api' + file.relPath);
    };
    
    

    FM.clickFile = function (file) {
      if (file.folder) {
        // open folder by setting url hash
        $location.path(decodeURIComponent(file.relPath));
      }
      else {
        // download file
        //downloadFile(file);
        file.selected = !(file.selected || false);
      }
    };

    FM.download = function () {
      for (var i in FM.selection) {
        downloadFile(FM.selection[i]);
      }
    };

    FM.delete = function () {
      for (var i in FM.selection) {
        var relPath = FM.selection[i].relPath;
        var url = 'api' + relPath;
        httpRequest('DELETE', url, null, null);
      }
    };

    FM.move = function (target) {
      var url = 'api' + target;
      var src = FM.selection.map(function (file) {
        return file.relPath;
      });
      httpRequest('PUT', url, {type: 'MOVE'}, {src: src});
    };

    FM.rename = function (newName) {
      var url = 'api' + FM.selection[0].relPath;
      var target = FM.curFolderPath + newName;
      console.log('rename target', target);
      httpRequest('PUT', url, {type: 'RENAME'}, {target: target});
    };

    FM.createFolder = function (folderName) {
      var url = 'api' + FM.curFolderPath + folderName;
      httpRequest('POST', url, {type: 'CREATE_FOLDER'}, null);
    };

    FM.upload = function (file) {
      console.log("upload", file);
      if(file) {
        FM.uploadFile = file;
      }
      console.log('Upload File:', FM.uploadFile);
      var formData = new FormData();
      formData.append('upload', FM.uploadFile);
      var url = 'api' + FM.curFolderPath + FM.uploadFile.name;
      httpRequest('POST', url, {type: 'UPLOAD_FILE'}, formData, {
        transformRequest: angular.identity,
        headers: {'Content-Type': undefined}
      });
    };

    FM.btnDisabled = function (btnName) {
      switch (btnName) {
        case 'download':
          if (FM.selection.length === 0) return true;
          else {
            for (var i in FM.selection) {
              if (FM.selection[i].folder) return true;
            }
            return false;
          }
        case 'delete':
        case 'move':
          return FM.selection.length === 0;
        case 'rename':
          return FM.selection.length !== 1;
        case 'upload_file':
        case 'create_folder':
          return false;
        default:
          return true;
      }
    }
  }
])
.directive('filedz', function(){
  return {
    restrict: 'EA',
    /*scope: {
      uploadFunc: '&'
    },*/
    scope: false,
    link: function (scope, element, attrs) {
      //var upload = attrs.filedz;
      //console.log("filedz", typeof(scope.uploadFunc));
      
      function dragenter(e) {
        e.stopPropagation();
        e.preventDefault();
      }

      function dragover(e) {
        e.stopPropagation();
        e.preventDefault();
      }
      
      function drop(e) {
        e.stopPropagation();
        e.preventDefault();

        var dt = e.originalEvent.dataTransfer;
        var files = dt.files;

        handleFiles(files);
      }
      
      function handleFiles(files) {
        //console.log(files);
        for(var i = 0; i < files.length; i++){
          var file = files[i];
          //console.log(scope);
          scope.FM.upload(file);
        }
      }
      
      /*function uploadFile(file){
        var xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', uploadProgress, false);
        xhr.onreadystatechange = stateChange;
        xhr.open('POST', '/api');
        xhr.setRequestHeader('X-FILE-NAME', file.name);
        xhr.send(file);
      }
      
      function uploadProgress(event) {
        var percent = parseInt(event.loaded / event.total * 100);
        $('.dropzone').text('Uploading: ' + percent + '%');
      }
      */
      element.bind('dragover', dragover);
      element.bind('dragenter', dragenter);
      return element.bind('drop', drop);
    }
    
  }
})
.directive('fileDropzone', function() {
  return {
    restrict: 'A',
    scope: {
      file: '=',
      fileName: '='
    },
    link: function(scope, element, attrs) {
      var checkSize, isTypeValid, processDragOverOrEnter, validMimeTypes;
      processDragOverOrEnter = function(event) {
        if (event != null) {
          event.preventDefault();
        }
        console.log(event);
        event.dataTransfer.effectAllowed = 'copy';
        return false;
      };
      validMimeTypes = attrs.fileDropzone;
      checkSize = function(size) {
        var _ref;
        if (((_ref = attrs.maxFileSize) === (void 0) || _ref === '') || (size / 1024) / 1024 < attrs.maxFileSize) {
          return true;
        } else {
          alert("File must be smaller than " + attrs.maxFileSize + " MB");
          return false;
        }
      };
      isTypeValid = function(type) {
        if ((validMimeTypes === (void 0) || validMimeTypes === '') || validMimeTypes.indexOf(type) > -1) {
          return true;
        } else {
          alert("Invalid file type.  File must be one of following types " + validMimeTypes);
          return false;
        }
      };
      element.bind('dragover', processDragOverOrEnter);
      element.bind('dragenter', processDragOverOrEnter);
      return element.bind('drop', function(event) {
        var file, name, reader, size, type;
        if (event != null) {
          event.preventDefault();
        }
        reader = new FileReader();
        reader.onload = function(evt) {
          if (checkSize(size) && isTypeValid(type)) {
            return scope.$apply(function() {
              scope.file = evt.target.result;
              if (angular.isString(scope.fileName)) {
                return scope.fileName = name;
              }
            });
          }
        };
        file = event.dataTransfer.files[0];
        name = file.name;
        type = file.type;
        size = file.size;
        reader.readAsDataURL(file);
        return false;
      });
    }
  };
});
