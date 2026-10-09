<template>
  <div
    id="viewer"
    class="col-12 px-0 h-100"
  ></div>
</template>

<script>
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { JSONFGLoader } from '../jsonfg-threejs-loader';
import { CityJSONWorkerParser } from '../jsonfg-threejs-loader';
import { sRGBEncoding } from 'three';

export default {
	name: 'ThreeJsViewer',
	props: {
		featureCollection: {
			type: Object,
			default: function () {

				return {};

			}
		},
		selectedObjid: {
			type: String,
			default: null
		},
		selectedObjidx: {
			type: Number,
			default: null
		},
		// selectedGeomIdx: {
		// 	type: Number,
		// 	default: - 1,
		// },
		selectedBoundaryIdx: {
			type: Number,
			default: - 1
		},
		highlightSelectedSurface: {
			type: Boolean,
			default: false
		},
		selectionColor: {
			type: Number,
			default: 0xffc107
		},
		objectColors: {
			type: Object,
			default: function () {

				return {
					"Building": 0x7497df,
					"BuildingPart": 0x7497df,
					"BuildingInstallation": 0x7497df,
					"Bridge": 0x999999,
					"BridgePart": 0x999999,
					"BridgeInstallation": 0x999999,
					"BridgeConstructionElement": 0x999999,
					"CityObjectGroup": 0xffffb3,
					"CityFurniture": 0xcc0000,
					"GenericCityObject": 0xcc0000,
					"LandUse": 0xffffb3,
					"PlantCover": 0x39ac39,
					"Railway": 0x000000,
					"Road": 0x999999,
					"SolitaryVegetationObject": 0x39ac39,
					"TINRelief": 0xffdb99,
					"TransportSquare": 0x999999,
					"Tunnel": 0x999999,
					"TunnelPart": 0x999999,
					"TunnelInstallation": 0x999999,
					"WaterBody": 0x4da6ff
				};

			}
		},
		backgroundColor: {
			type: Number,
			default: 0x000000
		},
		showSemantics: {
			type: Boolean,
			default: false
		},
		activeLod: {
			type: Number,
			default: - 1
		},
		cameraSpotlight: {
			type: Boolean,
			default: true
		}
	},
	data() {

		return {

			camera_init: true,
			lods: [],
			previousPos: {
				x: - 1,
				y: - 1
			},
			parser: null,

		};

	},
	watch: {
		backgroundColor: function ( newVal ) {

			this.renderer.setClearColor( newVal );

			this.updateScene();

		},
		objectColors: {
			handler: function () {

				this.refreshColors();
				this.updateScene();

			},
			deep: true
		},
		selectionColor: function () {

			this.refreshColors();
			this.updateScene();

		},
		featureCollection: {
			handler: function ( newfeatureCollection ) {

				this.clearScene();

				this.loadFeatureCollection( newfeatureCollection );

				this.updateScene();

			},
			deep: true
		},
		selectedObjid: function () {

			this.updateScene();

		},
		// selectedGeomIdx: function () {

		// 	this.updateScene();

		// },
		selectedBoundaryIdx: function () {

			this.updateScene();

		},
		highlightSelectedSurface: function () {

			this.scene.traverse( c => {

				if ( c.material && c.material.uniforms ) {

					c.material.uniforms.selectSurface.value = this.highlightSelectedSurface;

				}

			} );

			this.updateScene();

		},
		showSemantics: function ( value ) {

			this.scene.traverse( c => {

				if ( c.material && c.material.uniforms ) {

					c.material.uniforms.showSemantics.value = value;

				}

			} );

			this.updateScene();

		},
		activeLod: function ( lodIdx ) {

			this.scene.traverse( c => {

				// Lines and points are split by LoD at load time
				if ( c.userData.lodIdx !== undefined ) {

					c.visible = lodIdx < 0 || c.userData.lodIdx === lodIdx;

				} else if ( c.material ) {

					c.material.showLod = lodIdx;
					// c.material.uniforms.showLod.value = lodIdx;

				}

			} );

			this.updateScene();

		},
		cameraSpotlight: function () {

			this.updateScene();

		}
	},
	beforeCreate() {

		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.controls = null;
		this.raycaster = null;
		this.mouse = null;
		this.spotLight = null;

	},
	mounted() {

		this.initScene();

		this.loadFeatureCollection( this.featureCollection );

		this.updateScene();

		this.renderer.domElement.addEventListener( 'pointerdown', this.pointerDown, false );
		this.renderer.domElement.addEventListener( 'pointermove', this.pointerMove, false );
		this.renderer.domElement.addEventListener( 'pointerup', this.pointerUp, false );

	},
	methods: {
		loadFeatureCollection( featureCollection ) {

			this.$emit( 'rendering', true );

			if ( featureCollection.features.length > 0 ) {

				this.parser = new CityJSONWorkerParser();
				this.parser.chunkSize = 2000;

				const scope = this;
				this.parser.onChunkLoad = () => {

					scope.lods = scope.parser.lods;

					scope.refreshColors();

					scope.updateScene();

					scope.$emit( 'chunkLoaded' );

				};
				this.parser.onComplete = () => {

					if ( ! scope.parser.loading ) {

						scope.$emit( 'rendering', false );

					}

				};

				// const loader = new CityJSONLoader( this.parser );
				const loader = new JSONFGLoader( this.parser );
				loader.load( featureCollection );

				this.scene.add( loader.scene );
				this.parser = loader.parser;

				// this.refreshColors();

				// this.updateScene();

				// this.$emit( 'chunkLoaded' );
				// this.$emit( 'rendering', false );

			}

		},
		updateScene() {

			if ( this.cameraSpotlight ) {

				this.spotLight.position.copy( this.camera.position );

			}

			this.scene.traverse( c => {

				// TODO: fix highlighting
				if ( c.material && c.material.uniforms ) {
					// c.material.uniforms.selectSurface.value = this.highlightSelectedSurface;
					c.material.uniforms.highlightedObjId.value = this.selectedObjidx;
					// c.material.uniforms.highlightedGeomId.value = this.selectedGeomIdx;
					c.material.uniforms.highlightedBoundId.value = this.selectedBoundaryIdx;

				}

			} );
			
			this.renderer.render( this.scene, this.camera );

		},
		refreshColors() {

			const scope = this;

			this.scene.traverse( mesh => {

				if ( mesh.material && mesh.material.uniforms ) {

					for ( const objtype in scope.objectColors ) {

						const idx = Object.keys( scope.parser.objectColors ).indexOf( objtype );
						if ( idx > - 1 ) {

							const col = new THREE.Color();
							col.setHex( '0x' + this.objectColors[ objtype ].toString( 16 ) );
							mesh.material.color = col;
							// mesh.material.uniforms.objectColors.value[ idx ] = col;

						}

					}

					mesh.material.uniforms.highlightColor.value.setHex( '0x' + scope.selectionColor.toString( 16 ) );

				}

			} );

		},
		pointerDown( e ) {

			this.previousPos.x = e.clientX;
			this.previousPos.y = e.clientY;

		},
		pointerUp( e ) {

			if ( this.previousPos.x == e.clientX && this.previousPos.y == e.clientY ) {

				this.handleClick( e );

			}

		},
		pointerMove( e ) {

			if ( e.ctrlKey ) {

				this.handleClick( e );

			}

		},
		getActiveIntersection( results ) {

			// Filters through the results to find the first one for the active LoD

			if ( this.activeLod > - 1 ) {

				for ( let i = 0; i < results.length; i ++ ) {

					const { face, index, object } = results[ i ];

					// Lines and points have no face, only the index of their vertex
					const lodIdx = object.geometry.getAttribute( "lodid" ).getX( face ? face.a : index );

					if ( lodIdx == this.activeLod ) {

						return results[ i ];

					}

				}

			}

			return results[ 0 ];

		},
		handleClick( e ) {

			var rect = this.renderer.domElement.getBoundingClientRect();
			this.mouse.x = ( ( e.clientX - rect.left ) / this.renderer.domElement.clientWidth ) * 2 - 1;
			this.mouse.y = - ( ( e.clientY - rect.top ) / this.renderer.domElement.clientHeight ) * 2 + 1;

			//get cameraposition
			this.raycaster.setFromCamera( this.mouse, this.camera );

			//calculate intersects
			var intersects = this.raycaster.intersectObject( this.scene, true );

			//if clicked on nothing return
			if ( intersects.length == 0 ) {

				this.$emit( 'object_clicked', null );
				return;

			}

			const { face, index, object } = this.getActiveIntersection( intersects );
			const vertexIdx = face ? face.a : index;

			const objIds = object.geometry.getAttribute( 'objectid' );

			if ( objIds ) {

				const idx = objIds.getX( vertexIdx );

				// const geomId = object.geometry.getAttribute( 'geometryid' ).getX( face.a );
				const boundId = object.geometry.getAttribute( 'boundaryid' ).getX( vertexIdx );

				// const objectId = Object.keys( this.featureCollection.features )[ idx ];
				this.$emit( 'object_clicked', { feature_id: this.featureCollection.features[idx].id, feature_idx: idx, boundary_id: boundId } );

			}

		},
		initScene() {

			const viewer = document.getElementById( "viewer" );
			const ratio = viewer.clientWidth / viewer.clientHeight;

			this.scene = new THREE.Scene();
			this.camera = new THREE.PerspectiveCamera( 60, ratio, 0.0001, 4000 );
			this.camera.position.set( 0, - 1, 1 );
			this.camera.up.set( 0, 0, 1 );

			this.renderer = new THREE.WebGLRenderer( {
				antialias: true
			} );
			this.renderer.outputEncoding = sRGBEncoding;
			viewer.appendChild( this.renderer.domElement );
			this.renderer.setSize( viewer.clientWidth, viewer.clientHeight );
			this.renderer.setClearColor( this.backgroundColor );
			this.renderer.shadowMap.enabled = true;
			this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

			let self = this;

			// add raycaster and mouse (for clickable objects)
			this.raycaster = new THREE.Raycaster();
			// The scene is scaled to a radius of about 0.25
			this.raycaster.params.Line.threshold = 0.005;
			this.raycaster.params.Points.threshold = 0.005;
			this.mouse = new THREE.Vector2();

			//add AmbientLight (light that is only there that there's a minimum of light and you can see color)
			//kind of the natural daylight
			var am_light = new THREE.AmbientLight( 0x666666, 0.7 ); // soft white light
			this.scene.add( am_light );

			// Add directional light
			this.spotLight = new THREE.SpotLight( 0xDDDDDD );
			this.spotLight.position.set( 1, 2, 3 );
			this.spotLight.target = this.scene;
			// this.spotLight.castShadow = true;
			// spot_light.intensity = 0.4;
			// spot_light.position.normalize();
			this.scene.add( this.spotLight );

			//render & orbit controls
			this.controls = new OrbitControls( this.camera, this.renderer.domElement );
			this.controls.addEventListener( 'change', function () {

				self.updateScene();

			} );
			this.controls.target.set( 0, 0, 0 );
			// console.log(this.scene);

		},
		clearScene() {

			while ( this.scene.children.length > 0 ) {

				this.scene.remove( this.scene.children[ 0 ] );

			}

			var am_light = new THREE.AmbientLight( 0xFFFFFF, 0.7 ); // soft white light
			this.scene.add( am_light );

			// Add directional light
			var spot_light = new THREE.SpotLight( 0xDDDDDD );
			spot_light.position.set( 84616, - 1, 447422 );
			spot_light.target = this.scene;
			spot_light.castShadow = true;
			spot_light.intensity = 0.4;
			spot_light.position.normalize();
			this.scene.add( spot_light );

		},
		getLods() {

			return this.lods;

		}
	}
};
</script>
