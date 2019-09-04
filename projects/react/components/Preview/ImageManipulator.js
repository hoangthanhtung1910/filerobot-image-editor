import React, { Component } from 'react';
import { Canvas } from '../../styledComponents';
import { b64toBlob } from '../../utils';
import { CLOUDIMAGE_OPERATIONS } from '../../config';
import Cropper from 'cropperjs';
import uuidv4 from 'uuid/v4';
import { getEffectHandlerName } from '../../utils/effects.utils';


export default class ImageManipulator extends Component {
  constructor(props) {
    super();

    this.state = {
      ...props,
      queue: Array.from(Array(4).keys()),
      tempOperation: null,
      canvas: null,
      adjust: {
        brightness: 0,
        contrast: 0,
        gamma: 0,
        saturation: 0,
        exposure: 0
      }
    };
  }

  shouldComponentUpdate() { return false; }

  componentWillReceiveProps(nextProps) {
    if (nextProps.activeTab !== this.state.activeTab) {
      if (this.state.activeTab) this.destroyMode(this.state.activeTab);

      this.changeTab(nextProps.activeTab);
    }

    this.setState({ ...nextProps });
  }

  componentDidMount() {
    const src = this.state.src;
    const splittedSrc = src.split('/');
    let imageName = splittedSrc[splittedSrc.length - 1];
    this.props.updateState({
      isShowSpinner: true,
      applyChanges: this.applyChanges,
      applyOperations: this.applyOperations,
      saveImage: this.saveImage,
      updateCropDetails: this.updateCropDetails,
      resize: this.resize,
      addEffect: this.addFilterOrEffect,
      cleanTemp: this.cleanTemp,
      revert: this.revert,
      rotate: this.rotate,
      adjust: this.adjust,
      downloadImage: this.downloadImage
    });
    const canvas = this.getCanvasNode();
    const ctx = canvas.getContext('2d');

    /* Enable Cross Origin Image Editing */
    const img = new Image();
    img.crossOrigin = '';
    img.src = src;
    this.img = img;

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0, img.width, img.height);

      this.props.updateState({
        isShowSpinner: false,
        original: { height: img.height, width: img.width },
        canvasDimensions: { height: img.height, width: img.width, ratio: img.width / img.height }
      });
      this.setState({
        originalWidth: img.width,
        originalHeight: img.height,
        originalImage: img,
        imageName: imageName.indexOf('?') > -1 ? imageName.slice(0, imageName.indexOf('?')) : imageName,
        originalCanvas: canvas
      });

      this.CamanInstance = new window.Caman(canvas, function () { });
    }
  }

  saveImage = () => {
    const { operations } = this.state;
    const {
      onComplete, onClose, updateState, closeOnLoad, config, processWithCloudimage, uploadCloudimageImage, imageMime
    } = this.props;
    const { filerobot = {} } = config;
    const src = this.state.src.split('?')[0];
    const canvas = this.getCanvasNode();
    const baseUrl = `//${filerobot.container}.api.airstore.io/v1/`;
    const uploadParams = filerobot.uploadParams || {};
    const dir = uploadParams.dir || 'image-editor';
    const self = this;
    let { imageName } = this.state;

    if (!processWithCloudimage) {
      this.CamanInstance.render(function () {
        const base64 = canvas.toDataURL(imageMime);
        const block = base64.split(";");
        const realData = block[1].split(",")[1];
        const blob = b64toBlob(realData, imageMime, null);
        const splittedName = imageName.replace(/-version-.{6}/g, '').split('.');
        const nameLength = splittedName.length;
        let name = '';

        if (nameLength <= 1) {
          name = `${splittedName.join('.')}-version-${(uuidv4() || '').slice(0, 6)}`;
        } else {
          name = [
            splittedName.slice(0, nameLength - 1).join('.'),
            '-version-',
            (uuidv4() || '').slice(0, 6),
            '.',
            splittedName[nameLength - 1]
          ].join('');
        }

        const formData = new FormData();
        const request = new XMLHttpRequest();

        request.addEventListener("load", self.onFileLoad);
        formData.append('files[]', blob, name);
        request.open("POST", [baseUrl, `upload?dir=${dir}`].join(''));
        request.setRequestHeader('X-Airstore-Secret-Key', filerobot.uploadKey);
        request.send(formData);
      });
    } else {
      const allowedOperations = operations.filter(({ stack }) => CLOUDIMAGE_OPERATIONS.indexOf(stack[0].name) > -1);
      const url = this.generateCloudimageURL(allowedOperations);
      const original = src.replace(/https?:\/\/scaleflex.ultrafast.io\//, '');
      const resultUrl = url + original;

      if (uploadCloudimageImage) {
        const request = new XMLHttpRequest();

        request.addEventListener("load", this.onFileLoad);

        request.open("POST", [baseUrl, `upload?dir=${dir}`].join(''));
        request.setRequestHeader('X-Airstore-Secret-Key', filerobot.uploadKey);
        request.setRequestHeader('Content-Type', 'application/json');
        request.send(JSON.stringify({ files_urls: [resultUrl] }));
      } else {
        updateState({ isShowSpinner: false, isHideCanvas: false });
        onComplete(resultUrl, { url_permalink: resultUrl, url_public: resultUrl });
        closeOnLoad && onClose();
      }
    }
  }

  downloadImage = () => {
    const canvas = this.getCanvasNode();
    const { imageName } = this.state;
    const { imageMime } = this.props;
    const lnk = document.createElement('a');
    let e;

    lnk.download = imageName;
    lnk.href = canvas.toDataURL(imageMime, 0.8);

    if (document.createEvent) {
      e = document.createEvent("MouseEvents");
      e.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
      lnk.dispatchEvent(e);
    } else if (lnk.fireEvent) {
      lnk.fireEvent("onclick");
    }
  }

  onFileLoad = (data) => {
    const { onComplete, onClose, updateState, closeOnLoad } = this.props;
    const { srcElement = {} } = data;
    const { response = '{}' } = srcElement;
    const responseData = JSON.parse(response) || {};

    if (responseData.status === 'success') {
      const { file = {} } = responseData;

      if (!file.url_public) return;

      updateState({ isShowSpinner: false, isHideCanvas: false });
      onComplete(file.url_public, file);
      closeOnLoad && onClose();
    } else {
      updateState({ isShowSpinner: false, isHideCanvas: false });
      alert(responseData);
      closeOnLoad && onClose();
    }
  }

  generateCloudimageURL = (operations) => {
    const { config } = this.props;
    const { cloudimage = {} } = config;
    const cloudUrl = cloudimage.token + '.cloudimg.io' + '/';
    const cropOperation = this.isOperationExist(operations, 'crop');
    const resizeOperation = this.isOperationExist(operations, 'resize');
    const orientationOperation = this.isOperationExist(operations, 'rotate')
    let operationQ = this.getOperationQuery(cropOperation, resizeOperation);
    let cropParams = null;
    let resizeParams = null;
    let orientationParams = null;

    if (cropOperation)
      cropParams = this.getCropArguments(cropOperation);

    let [cropWidth, cropHeight, x, y] = cropParams || [];

    if (resizeOperation)
      resizeParams = this.getResizeArguments(resizeOperation);

    if (orientationOperation)
      orientationParams = this.getOrientationArguments(orientationOperation);

    let [resizeWidth, resizeHeight] = resizeParams || [];

    const cropQ = cropOperation ? (x + ',' + y + ',' + (x + cropWidth) + ',' + (y + cropHeight) + '-') : '';
    const resizeQ = (resizeWidth || cropWidth) ? (resizeWidth || cropWidth) + 'x' + (resizeHeight || cropHeight) : '';
    const sizesQ = cropQ || resizeQ ? cropQ + resizeQ : 'n';
    const rotateQ = orientationParams ? orientationParams : '';
    const filtersQ = rotateQ ? `r${rotateQ}` : 'n';

    if ((operationQ === 'cdn') && (filtersQ !== 'n')) operationQ = 'cdno';

    return 'https://' + cloudUrl + operationQ + '/' + sizesQ + '/' + filtersQ + '/';
  }

  /* Filters and Effects */

  initFiltersOrEffects = () => {}

  addFilterOrEffect = name => {
    const effectHandlerName = getEffectHandlerName(name);
    const { currentOperation, operations } = this.state;
    const that = this;
    let operation = {
      stack: [
        { name: effectHandlerName, arguments: [], queue: 2 }
      ]
    };

    this.setState({ tempOperation: operation });

    this.CamanInstance.reset();

    this.applyOperations(
      operations,
      operations.findIndex(operation => operation === currentOperation),
      () => {
        this.CamanInstance[effectHandlerName]();
        this.CamanInstance.render(() => {
          that.props.updateState({ isHideCanvas: false, isShowSpinner: false });
        });
      }
    );
  }

  applyFilterOrEffect = () => {
    const { currentOperation, operations, tempOperation } = this.state;
    this.pushOperation(operations, tempOperation, currentOperation);
    this.props.updateState({ isHideCanvas: false, activeTab: null, operations, currentOperation: tempOperation });
  }
  
  /* Rotate */

  initOrientation = () => {}

  rotate = (value, total) => {
    const that = this;

    this.CamanInstance.rotate(value);
    this.CamanInstance.render(() => {
      that.setState({ rotate: total });
    });
  }

  applyOrientation = () => {
    const { currentOperation, operations, rotate } = this.state;
    let operation = {
      stack: [
        { name: 'rotate', arguments: [rotate], queue: 0 }
      ]
    };

    this.pushOperation(operations, operation, currentOperation);
    this.setState({ rotate: null });
    this.props.updateState({ isHideCanvas: false, activeTab: null, operations, currentOperation: operation });
  }

  getOrientationArguments = (operation = {}) => {
    const { stack = [] } = operation;
    const rotate = stack[0] && stack[0].arguments && stack[0].arguments[0] || 0;

    // todo: need to find better way or ask julian to redo it on server
    switch (rotate) {
      case 90:
        return 270;
      case -90:
        return 90;
      default:
        return rotate;
    }
  }

  /* Crop */

  initCrop = () => {
    const { originalWidth } = this.state;
    const canvas = this.getCanvasNode();
    const rect = canvas.getBoundingClientRect();
    const zoom = originalWidth / rect.width;

    this.cropper = new Cropper(canvas, {
      viewMode: 1,
      modal: false,
      background: false,
      rotatable: false,
      scalable: false,
      zoomable: false,
      movable: false,
      crop: event => {
        this.setState({ cropDetails: event.detail });
        this.props.updateState({ cropDetails: event.detail });
      }
    });

    window.scaleflexPlugins = window.scaleflexPlugins || {};
    window.scaleflexPlugins.zoom = zoom;
    window.scaleflexPlugins.cropperjs = this.cropper;
  }

  applyCrop = () => {
    const { cropDetails, currentOperation, operations } = this.state;
    const { width, height, x, y } = cropDetails;
    const canvas = this.getCanvasNode();
    const that = this;
    let operation = {
      stack: [
        { name: 'crop', arguments: [width, height, x, y], queue: 0 }
      ]
    };

    this.pushOperation(operations, operation, currentOperation);
    this.destroyCrop();


    this.CamanInstance.crop(width, height, x, y);
    this.CamanInstance.render(() => {
      canvas.width = width;
      canvas.height = height;

      this.CamanInstance = new window.Caman(canvas, function () { });

      that.props.updateState({
        isHideCanvas: false,
        activeTab: null,
        operations,
        currentOperation: operation,
        canvasDimensions: { width, height, ratio: width / height }
      });
    });
  }

  destroyCrop = () => {
    this.cropper.destroy();
  }

  getCropArguments = (operation = {}) => {
    const { stack = [] } = operation;
    let params = stack[0] && stack[0].arguments;

    params = params.map(value => parseInt(value));

    return params;
  }

  /* Resize */

  initResize = () => {}

  applyResize = () => {
    const { currentOperation, operations } = this.state;
    const { canvasDimensions } = this.props;
    const { width, height } = canvasDimensions;
    const that = this;
    let operation = {
      stack: [
        { name: 'resize', arguments: [{ width, height }], queue: 0 }
      ]
    };

    this.pushOperation(operations, operation, currentOperation);

    this.CamanInstance.resize({ width, height });
    this.CamanInstance.render(() => {
      that.props.updateState({ isHideCanvas: false, activeTab: null, operations, currentOperation: operation });
    });
  }

  getResizeArguments = (operation = {}) => {
    const { stack = [] } = operation;
    let props = stack[0] && stack[0].arguments && stack[0].arguments[0];

    return [parseInt(props.width), parseInt(props.height)];
  }

  /* Adjust */

  initAdjust = () => {}

  adjust = (handler, value) => {
    const { operations = [], currentOperation, adjust } = this.state;
    const that = this;

    Object.assign(adjust, { [handler]: value });

    this.setState(adjust); // ??? todo check if we need it

    if (operations.some(operation => operation.stack.some(stack => stack.name === 'crop' || stack.name === 'resize'))) {
      this.CamanInstance.reset();
    } else {
      this.CamanInstance.revert(false);
    }

    this.applyOperations(
      operations,
      operations.findIndex(operation => operation === currentOperation),
      () => {
        this.CamanInstance.brightness(parseInt((adjust.brightness || 0)));
        this.CamanInstance.contrast(parseInt((adjust.contrast || 0)));
        this.CamanInstance.exposure(parseFloat((adjust.exposure || 0)));
        this.CamanInstance.saturation(parseInt((adjust.saturation || 0)));

        this.CamanInstance.render(() => {
          that.props.updateState({ isHideCanvas: false, isShowSpinner: false });
        });
      }
    );
  }

  applyAdjust = () => {
    const { currentOperation, operations, adjust } = this.state;
    let operation = {
      stack: [
        { name: 'brightness', arguments: [adjust.brightness], queue: 3 },
        { name: 'contrast', arguments: [adjust.contrast], queue: 3 },
        { name: 'saturation', arguments: [adjust.saturation], queue: 3 },
        { name: 'exposure', arguments: [adjust.exposure], queue: 3 },
      ]
    };
    this.pushOperation(operations, operation, currentOperation);
    this.props.updateState({ isHideCanvas: false, activeTab: null, operations, currentOperation: operation });
  }


  /* Operation utils */

  pushOperation = (operations, operation, currentOperation) => {
    const operationIndex = operations.findIndex(operation => operation === currentOperation);
    const operationsLength = operations.length;

    if (operationsLength && (operationIndex !== operations[operationsLength]))
      operations.splice(operationIndex + 1, operationsLength);

    operations.push(operation);
  }

  applyOperations = (operations = [], operationIndex, callback) => {
    const { queue } = this.state;
    const that = this;


    queue.forEach(queueIndex => {
      operations.forEach((operation, index) => {
        if (operationIndex < index || operationIndex === -1) return;

        operation.stack.forEach(handler => {
          if (handler.queue === queueIndex) this.CamanInstance[handler.name](...handler.arguments);
        });
      });

      if (operationIndex > -1) this.CamanInstance.render(() => {
        that.props.updateState({ currentOperation: operations[operationIndex] });
        if (callback) callback();
      });
    })

    if (!(operationIndex > -1)) {
      that.props.updateState({ currentOperation: operations[operationIndex] });
      setTimeout(() => { if (callback) callback(); })
    }
  }

  isOperationExist = (operations, type) => operations.find(({ stack }) => stack[0].name === type);

  getOperationQuery = (isCrop, isResize) => {
    if (isCrop) return 'crop_px';
    else if (isResize) return 'width';
    else return 'cdn';
  }



  destroyAll = () => {}

  revert = (callback) => {
    const oldcanv = document.getElementById('scaleflex-image-edit-box');
    const container = oldcanv.parentElement;
    container.removeChild(oldcanv)

    const canvas = document.createElement('canvas');
    canvas.id = 'scaleflex-image-edit-box';

    //const canvas = this.getCanvasNode();
    const ctx = canvas.getContext('2d');

    /* Enable Cross Origin Image Editing */
    const img = new Image();
    img.crossOrigin = '';
    img.src = this.state.src;

    img.onload = () => {
      this.CamanInstance = new window.Caman(canvas, function () { });

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, img.width, img.height);

      this.props.updateState({
        original: { height: img.height, width: img.width },
        canvasDimensions: { height: img.height, width: img.width, ratio: img.width / img.height }
      });
      this.setState({
        originalWidth: img.width, originalHeight: img.height, originalImage: img
      });

      container.appendChild(canvas);
      if (callback) setTimeout(() => { callback(); });
    }

  }

  cleanTemp = () => {
    const { operations, currentOperation } = this.state;

    this.CamanInstance.reset();
    this.applyOperations(
      operations,
      operations.findIndex(operation => operation === currentOperation),
      () => {
        this.setState({ tempOperation: null });
        this.props.updateState({ isHideCanvas: false, isShowSpinner: false });
      }
    );
  }



  applyChanges = (activeTab) => {
    switch (activeTab) {
      case 'effects':
      case 'filters':
        this.applyFilterOrEffect();
        break;
      case 'adjust':
        this.applyAdjust();
        break;
      case 'crop':
        this.applyCrop();
        break;
      case 'rotate':
        this.applyOrientation();
        break;
      case 'resize':
        this.applyResize();
        break;
      default:
        break;
    }
  }

  changeTab = (name) => {
    switch (name) {
      case 'effects':
      case 'filters':
        this.initFiltersOrEffects();
        break;
      case 'adjust':
        this.initAdjust();
        break;
      case 'crop':
        this.initCrop();
        break;
      case 'resize':
        this.initResize();
        break;
      case 'rotate':
        this.initOrientation();
        break;
      default:
        this.destroyAll();
    }
  }

  destroyMode = (name) => {
    switch (name) {
      case 'effects':
        break;
      case 'filters':
        break;
      case 'adjust':
        break;
      case 'crop':
        this.destroyCrop();
        break;
      case 'resize':
        break;
      case 'rotate':
        break;
      default:
        break;
    }
  }
  
  getCanvasNode = () => document.getElementById('scaleflex-image-edit-box');

  render() { return <Canvas id="scaleflex-image-edit-box"/>; }
}