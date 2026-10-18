/* Three.js r160 fat-line addons (examples/jsm/lines: LineSegmentsGeometry, LineGeometry, LineMaterial, LineSegments2, Line2),
   vendored unchanged except that they read the global THREE from the cdnjs script instead of importing 'three', and the
   files' private module-level temporaries carry a suffix so they can share one module. MIT © 2010-2023 three.js authors.
   Source: https://unpkg.com/three@0.160.0/examples/jsm/lines/ */
const { Box3, Float32BufferAttribute, InstancedBufferGeometry, InstancedInterleavedBuffer, InterleavedBufferAttribute, Line3, MathUtils, Matrix4, Mesh, ShaderLib, ShaderMaterial, Sphere, UniformsLib, UniformsUtils, Vector2, Vector3, Vector4, WireframeGeometry } = THREE;

/* ---- LineSegmentsGeometry.js ---- */
const _box_0 = new Box3();
const _vector_0 = new Vector3();

class LineSegmentsGeometry extends InstancedBufferGeometry {

	constructor() {

		super();

		this.isLineSegmentsGeometry = true;

		this.type = 'LineSegmentsGeometry';

		const positions = [ - 1, 2, 0, 1, 2, 0, - 1, 1, 0, 1, 1, 0, - 1, 0, 0, 1, 0, 0, - 1, - 1, 0, 1, - 1, 0 ];
		const uvs = [ - 1, 2, 1, 2, - 1, 1, 1, 1, - 1, - 1, 1, - 1, - 1, - 2, 1, - 2 ];
		const index = [ 0, 2, 1, 2, 3, 1, 2, 4, 3, 4, 5, 3, 4, 6, 5, 6, 7, 5 ];

		this.setIndex( index );
		this.setAttribute( 'position', new Float32BufferAttribute( positions, 3 ) );
		this.setAttribute( 'uv', new Float32BufferAttribute( uvs, 2 ) );

	}

	applyMatrix4( matrix ) {

		const start = this.attributes.instanceStart;
		const end = this.attributes.instanceEnd;

		if ( start !== undefined ) {

			start.applyMatrix4( matrix );

			end.applyMatrix4( matrix );

			start.needsUpdate = true;

		}

		if ( this.boundingBox !== null ) {

			this.computeBoundingBox();

		}

		if ( this.boundingSphere !== null ) {

			this.computeBoundingSphere();

		}

		return this;

	}

	setPositions( array ) {

		let lineSegments;

		if ( array instanceof Float32Array ) {

			lineSegments = array;

		} else if ( Array.isArray( array ) ) {

			lineSegments = new Float32Array( array );

		}

		const instanceBuffer = new InstancedInterleavedBuffer( lineSegments, 6, 1 ); // xyz, xyz

		this.setAttribute( 'instanceStart', new InterleavedBufferAttribute( instanceBuffer, 3, 0 ) ); // xyz
		this.setAttribute( 'instanceEnd', new InterleavedBufferAttribute( instanceBuffer, 3, 3 ) ); // xyz

		//

		this.computeBoundingBox();
		this.computeBoundingSphere();

		return this;

	}

	setColors( array ) {

		let colors;

		if ( array instanceof Float32Array ) {

			colors = array;

		} else if ( Array.isArray( array ) ) {

			colors = new Float32Array( array );

		}

		const instanceColorBuffer = new InstancedInterleavedBuffer( colors, 6, 1 ); // rgb, rgb

		this.setAttribute( 'instanceColorStart', new InterleavedBufferAttribute( instanceColorBuffer, 3, 0 ) ); // rgb
		this.setAttribute( 'instanceColorEnd', new InterleavedBufferAttribute( instanceColorBuffer, 3, 3 ) ); // rgb

		return this;

	}

	fromWireframeGeometry( geometry ) {

		this.setPositions( geometry.attributes.position.array );

		return this;

	}

	fromEdgesGeometry( geometry ) {

		this.setPositions( geometry.attributes.position.array );

		return this;

	}

	fromMesh( mesh ) {

		this.fromWireframeGeometry( new WireframeGeometry( mesh.geometry ) );

		// set colors, maybe

		return this;

	}

	fromLineSegments( lineSegments ) {

		const geometry = lineSegments.geometry;

		this.setPositions( geometry.attributes.position.array ); // assumes non-indexed

		// set colors, maybe

		return this;

	}

	computeBoundingBox() {

		if ( this.boundingBox === null ) {

			this.boundingBox = new Box3();

		}

		const start = this.attributes.instanceStart;
		const end = this.attributes.instanceEnd;

		if ( start !== undefined && end !== undefined ) {

			this.boundingBox.setFromBufferAttribute( start );

			_box_0.setFromBufferAttribute( end );

			this.boundingBox.union( _box_0 );

		}

	}

	computeBoundingSphere() {

		if ( this.boundingSphere === null ) {

			this.boundingSphere = new Sphere();

		}

		if ( this.boundingBox === null ) {

			this.computeBoundingBox();

		}

		const start = this.attributes.instanceStart;
		const end = this.attributes.instanceEnd;

		if ( start !== undefined && end !== undefined ) {

			const center = this.boundingSphere.center;

			this.boundingBox.getCenter( center );

			let maxRadiusSq = 0;

			for ( let i = 0, il = start.count; i < il; i ++ ) {

				_vector_0.fromBufferAttribute( start, i );
				maxRadiusSq = Math.max( maxRadiusSq, center.distanceToSquared( _vector_0 ) );

				_vector_0.fromBufferAttribute( end, i );
				maxRadiusSq = Math.max( maxRadiusSq, center.distanceToSquared( _vector_0 ) );

			}

			this.boundingSphere.radius = Math.sqrt( maxRadiusSq );

			if ( isNaN( this.boundingSphere.radius ) ) {

				console.error( 'THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.', this );

			}

		}

	}

	toJSON() {

		// todo

	}

	applyMatrix( matrix ) {

		console.warn( 'THREE.LineSegmentsGeometry: applyMatrix() has been renamed to applyMatrix4().' );

		return this.applyMatrix4( matrix );

	}

}

export { LineSegmentsGeometry };

/* ---- LineGeometry.js ---- */
class LineGeometry extends LineSegmentsGeometry {

	constructor() {

		super();

		this.isLineGeometry = true;

		this.type = 'LineGeometry';

	}

	setPositions( array ) {

		// converts [ x1, y1, z1,  x2, y2, z2, ... ] to pairs format

		const length = array.length - 3;
		const points = new Float32Array( 2 * length );

		for ( let i = 0; i < length; i += 3 ) {

			points[ 2 * i ] = array[ i ];
			points[ 2 * i + 1 ] = array[ i + 1 ];
			points[ 2 * i + 2 ] = array[ i + 2 ];

			points[ 2 * i + 3 ] = array[ i + 3 ];
			points[ 2 * i + 4 ] = array[ i + 4 ];
			points[ 2 * i + 5 ] = array[ i + 5 ];

		}

		super.setPositions( points );

		return this;

	}

	setColors( array ) {

		// converts [ r1, g1, b1,  r2, g2, b2, ... ] to pairs format

		const length = array.length - 3;
		const colors = new Float32Array( 2 * length );

		for ( let i = 0; i < length; i += 3 ) {

			colors[ 2 * i ] = array[ i ];
			colors[ 2 * i + 1 ] = array[ i + 1 ];
			colors[ 2 * i + 2 ] = array[ i + 2 ];

			colors[ 2 * i + 3 ] = array[ i + 3 ];
			colors[ 2 * i + 4 ] = array[ i + 4 ];
			colors[ 2 * i + 5 ] = array[ i + 5 ];

		}

		super.setColors( colors );

		return this;

	}

	fromLine( line ) {

		const geometry = line.geometry;

		this.setPositions( geometry.attributes.position.array ); // assumes non-indexed

		// set colors, maybe

		return this;

	}

}

export { LineGeometry };

/* ---- LineMaterial.js ---- */
/**
 * parameters = {
 *  color: <hex>,
 *  linewidth: <float>,
 *  dashed: <boolean>,
 *  dashScale: <float>,
 *  dashSize: <float>,
 *  dashOffset: <float>,
 *  gapSize: <float>,
 *  resolution: <Vector2>, // to be set by renderer
 * }
 */




UniformsLib.line = {

	worldUnits: { value: 1 },
	linewidth: { value: 1 },
	resolution: { value: new Vector2( 1, 1 ) },
	dashOffset: { value: 0 },
	dashScale: { value: 1 },
	dashSize: { value: 1 },
	gapSize: { value: 1 } // todo FIX - maybe change to totalSize

};

ShaderLib[ 'line' ] = {

	uniforms: UniformsUtils.merge( [
		UniformsLib.common,
		UniformsLib.fog,
		UniformsLib.line
	] ),

	vertexShader:
	/* glsl */`
		#include <common>
		#include <color_pars_vertex>
		#include <fog_pars_vertex>
		#include <logdepthbuf_pars_vertex>
		#include <clipping_planes_pars_vertex>

		uniform float linewidth;
		uniform vec2 resolution;

		attribute vec3 instanceStart;
		attribute vec3 instanceEnd;

		attribute vec3 instanceColorStart;
		attribute vec3 instanceColorEnd;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#ifdef USE_DASH

			uniform float dashScale;
			attribute float instanceDistanceStart;
			attribute float instanceDistanceEnd;
			varying float vLineDistance;

		#endif

		void trimSegment( const in vec4 start, inout vec4 end ) {

			// trim end segment so it terminates between the camera plane and the near plane

			// conservative estimate of the near plane
			float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
			float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
			float nearEstimate = - 0.5 * b / a;

			float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

			end.xyz = mix( start.xyz, end.xyz, alpha );

		}

		void main() {

			#ifdef USE_COLOR

				vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

			#endif

			#ifdef USE_DASH

				vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
				vUv = uv;

			#endif

			float aspect = resolution.x / resolution.y;

			// camera space
			vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
			vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

			#ifdef WORLD_UNITS

				worldStart = start.xyz;
				worldEnd = end.xyz;

			#else

				vUv = uv;

			#endif

			// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
			// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
			// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
			// perhaps there is a more elegant solution -- WestLangley

			bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

			if ( perspective ) {

				if ( start.z < 0.0 && end.z >= 0.0 ) {

					trimSegment( start, end );

				} else if ( end.z < 0.0 && start.z >= 0.0 ) {

					trimSegment( end, start );

				}

			}

			// clip space
			vec4 clipStart = projectionMatrix * start;
			vec4 clipEnd = projectionMatrix * end;

			// ndc space
			vec3 ndcStart = clipStart.xyz / clipStart.w;
			vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

			// direction
			vec2 dir = ndcEnd.xy - ndcStart.xy;

			// account for clip-space aspect ratio
			dir.x *= aspect;
			dir = normalize( dir );

			#ifdef WORLD_UNITS

				vec3 worldDir = normalize( end.xyz - start.xyz );
				vec3 tmpFwd = normalize( mix( start.xyz, end.xyz, 0.5 ) );
				vec3 worldUp = normalize( cross( worldDir, tmpFwd ) );
				vec3 worldFwd = cross( worldDir, worldUp );
				worldPos = position.y < 0.5 ? start: end;

				// height offset
				float hw = linewidth * 0.5;
				worldPos.xyz += position.x < 0.0 ? hw * worldUp : - hw * worldUp;

				// don't extend the line if we're rendering dashes because we
				// won't be rendering the endcaps
				#ifndef USE_DASH

					// cap extension
					worldPos.xyz += position.y < 0.5 ? - hw * worldDir : hw * worldDir;

					// add width to the box
					worldPos.xyz += worldFwd * hw;

					// endcaps
					if ( position.y > 1.0 || position.y < 0.0 ) {

						worldPos.xyz -= worldFwd * 2.0 * hw;

					}

				#endif

				// project the worldpos
				vec4 clip = projectionMatrix * worldPos;

				// shift the depth of the projected points so the line
				// segments overlap neatly
				vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
				clip.z = clipPose.z * clip.w;

			#else

				vec2 offset = vec2( dir.y, - dir.x );
				// undo aspect ratio adjustment
				dir.x /= aspect;
				offset.x /= aspect;

				// sign flip
				if ( position.x < 0.0 ) offset *= - 1.0;

				// endcaps
				if ( position.y < 0.0 ) {

					offset += - dir;

				} else if ( position.y > 1.0 ) {

					offset += dir;

				}

				// adjust for linewidth
				offset *= linewidth;

				// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
				offset /= resolution.y;

				// select end
				vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

				// back to clip space
				offset *= clip.w;

				clip.xy += offset;

			#endif

			gl_Position = clip;

			vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

			#include <logdepthbuf_vertex>
			#include <clipping_planes_vertex>
			#include <fog_vertex>

		}
		`,

	fragmentShader:
	/* glsl */`
		uniform vec3 diffuse;
		uniform float opacity;
		uniform float linewidth;

		#ifdef USE_DASH

			uniform float dashOffset;
			uniform float dashSize;
			uniform float gapSize;

		#endif

		varying float vLineDistance;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#include <common>
		#include <color_pars_fragment>
		#include <fog_pars_fragment>
		#include <logdepthbuf_pars_fragment>
		#include <clipping_planes_pars_fragment>

		vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

			float mua;
			float mub;

			vec3 p13 = p1 - p3;
			vec3 p43 = p4 - p3;

			vec3 p21 = p2 - p1;

			float d1343 = dot( p13, p43 );
			float d4321 = dot( p43, p21 );
			float d1321 = dot( p13, p21 );
			float d4343 = dot( p43, p43 );
			float d2121 = dot( p21, p21 );

			float denom = d2121 * d4343 - d4321 * d4321;

			float numer = d1343 * d4321 - d1321 * d4343;

			mua = numer / denom;
			mua = clamp( mua, 0.0, 1.0 );
			mub = ( d1343 + d4321 * ( mua ) ) / d4343;
			mub = clamp( mub, 0.0, 1.0 );

			return vec2( mua, mub );

		}

		void main() {

			#include <clipping_planes_fragment>

			#ifdef USE_DASH

				if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

				if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

			#endif

			float alpha = opacity;

			#ifdef WORLD_UNITS

				// Find the closest points on the view ray and the line segment
				vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
				vec3 lineDir = worldEnd - worldStart;
				vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

				vec3 p1 = worldStart + lineDir * params.x;
				vec3 p2 = rayEnd * params.y;
				vec3 delta = p1 - p2;
				float len = length( delta );
				float norm = len / linewidth;

				#ifndef USE_DASH

					#ifdef USE_ALPHA_TO_COVERAGE

						float dnorm = fwidth( norm );
						alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

					#else

						if ( norm > 0.5 ) {

							discard;

						}

					#endif

				#endif

			#else

				#ifdef USE_ALPHA_TO_COVERAGE

					// artifacts appear on some hardware if a derivative is taken within a conditional
					float a = vUv.x;
					float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
					float len2 = a * a + b * b;
					float dlen = fwidth( len2 );

					if ( abs( vUv.y ) > 1.0 ) {

						alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

					}

				#else

					if ( abs( vUv.y ) > 1.0 ) {

						float a = vUv.x;
						float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
						float len2 = a * a + b * b;

						if ( len2 > 1.0 ) discard;

					}

				#endif

			#endif

			vec4 diffuseColor = vec4( diffuse, alpha );

			#include <logdepthbuf_fragment>
			#include <color_fragment>

			gl_FragColor = vec4( diffuseColor.rgb, alpha );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>
			#include <fog_fragment>
			#include <premultiplied_alpha_fragment>

		}
		`
};

class LineMaterial extends ShaderMaterial {

	constructor( parameters ) {

		super( {

			type: 'LineMaterial',

			uniforms: UniformsUtils.clone( ShaderLib[ 'line' ].uniforms ),

			vertexShader: ShaderLib[ 'line' ].vertexShader,
			fragmentShader: ShaderLib[ 'line' ].fragmentShader,

			clipping: true // required for clipping support

		} );

		this.isLineMaterial = true;

		this.setValues( parameters );

	}

	get color() {

		return this.uniforms.diffuse.value;

	}

	set color( value ) {

		this.uniforms.diffuse.value = value;

	}

	get worldUnits() {

		return 'WORLD_UNITS' in this.defines;

	}

	set worldUnits( value ) {

		if ( value === true ) {

			this.defines.WORLD_UNITS = '';

		} else {

			delete this.defines.WORLD_UNITS;

		}

	}

	get linewidth() {

		return this.uniforms.linewidth.value;

	}

	set linewidth( value ) {

		if ( ! this.uniforms.linewidth ) return;
		this.uniforms.linewidth.value = value;

	}

	get dashed() {

		return 'USE_DASH' in this.defines;

	}

	set dashed( value ) {

		if ( ( value === true ) !== this.dashed ) {

			this.needsUpdate = true;

		}

		if ( value === true ) {

			this.defines.USE_DASH = '';

		} else {

			delete this.defines.USE_DASH;

		}

	}

	get dashScale() {

		return this.uniforms.dashScale.value;

	}

	set dashScale( value ) {

		this.uniforms.dashScale.value = value;

	}

	get dashSize() {

		return this.uniforms.dashSize.value;

	}

	set dashSize( value ) {

		this.uniforms.dashSize.value = value;

	}

	get dashOffset() {

		return this.uniforms.dashOffset.value;

	}

	set dashOffset( value ) {

		this.uniforms.dashOffset.value = value;

	}

	get gapSize() {

		return this.uniforms.gapSize.value;

	}

	set gapSize( value ) {

		this.uniforms.gapSize.value = value;

	}

	get opacity() {

		return this.uniforms.opacity.value;

	}

	set opacity( value ) {

		if ( ! this.uniforms ) return;
		this.uniforms.opacity.value = value;

	}

	get resolution() {

		return this.uniforms.resolution.value;

	}

	set resolution( value ) {

		this.uniforms.resolution.value.copy( value );

	}

	get alphaToCoverage() {

		return 'USE_ALPHA_TO_COVERAGE' in this.defines;

	}

	set alphaToCoverage( value ) {

		if ( ! this.defines ) return;

		if ( ( value === true ) !== this.alphaToCoverage ) {

			this.needsUpdate = true;

		}

		if ( value === true ) {

			this.defines.USE_ALPHA_TO_COVERAGE = '';
			this.extensions.derivatives = true;

		} else {

			delete this.defines.USE_ALPHA_TO_COVERAGE;
			this.extensions.derivatives = false;

		}

	}

}

export { LineMaterial };

/* ---- LineSegments2.js ---- */
const _start_3 = new Vector3();
const _end_3 = new Vector3();

const _start4_3 = new Vector4();
const _end4_3 = new Vector4();

const _ssOrigin_3 = new Vector4();
const _ssOrigin3_3 = new Vector3();
const _mvMatrix_3 = new Matrix4();
const _line_3 = new Line3();
const _closestPoint_3 = new Vector3();

const _box_3 = new Box3();
const _sphere_3 = new Sphere();
const _clipToWorldVector_3 = new Vector4();

let _ray, _lineWidth;

// Returns the margin required to expand by in world space given the distance from the camera,
// line width, resolution, and camera projection
function getWorldSpaceHalfWidth( camera, distance, resolution ) {

	// transform into clip space, adjust the x and y values by the pixel width offset, then
	// transform back into world space to get world offset. Note clip space is [-1, 1] so full
	// width does not need to be halved.
	_clipToWorldVector_3.set( 0, 0, - distance, 1.0 ).applyMatrix4( camera.projectionMatrix );
	_clipToWorldVector_3.multiplyScalar( 1.0 / _clipToWorldVector_3.w );
	_clipToWorldVector_3.x = _lineWidth / resolution.width;
	_clipToWorldVector_3.y = _lineWidth / resolution.height;
	_clipToWorldVector_3.applyMatrix4( camera.projectionMatrixInverse );
	_clipToWorldVector_3.multiplyScalar( 1.0 / _clipToWorldVector_3.w );

	return Math.abs( Math.max( _clipToWorldVector_3.x, _clipToWorldVector_3.y ) );

}

function raycastWorldUnits( lineSegments, intersects ) {

	const matrixWorld = lineSegments.matrixWorld;
	const geometry = lineSegments.geometry;
	const instanceStart = geometry.attributes.instanceStart;
	const instanceEnd = geometry.attributes.instanceEnd;
	const segmentCount = Math.min( geometry.instanceCount, instanceStart.count );

	for ( let i = 0, l = segmentCount; i < l; i ++ ) {

		_line_3.start.fromBufferAttribute( instanceStart, i );
		_line_3.end.fromBufferAttribute( instanceEnd, i );

		_line_3.applyMatrix4( matrixWorld );

		const pointOnLine = new Vector3();
		const point = new Vector3();

		_ray.distanceSqToSegment( _line_3.start, _line_3.end, point, pointOnLine );
		const isInside = point.distanceTo( pointOnLine ) < _lineWidth * 0.5;

		if ( isInside ) {

			intersects.push( {
				point,
				pointOnLine,
				distance: _ray.origin.distanceTo( point ),
				object: lineSegments,
				face: null,
				faceIndex: i,
				uv: null,
				uv1: null,
			} );

		}

	}

}

function raycastScreenSpace( lineSegments, camera, intersects ) {

	const projectionMatrix = camera.projectionMatrix;
	const material = lineSegments.material;
	const resolution = material.resolution;
	const matrixWorld = lineSegments.matrixWorld;

	const geometry = lineSegments.geometry;
	const instanceStart = geometry.attributes.instanceStart;
	const instanceEnd = geometry.attributes.instanceEnd;
	const segmentCount = Math.min( geometry.instanceCount, instanceStart.count );

	const near = - camera.near;

	//

	// pick a point 1 unit out along the ray to avoid the ray origin
	// sitting at the camera origin which will cause "w" to be 0 when
	// applying the projection matrix.
	_ray.at( 1, _ssOrigin_3 );

	// ndc space [ - 1.0, 1.0 ]
	_ssOrigin_3.w = 1;
	_ssOrigin_3.applyMatrix4( camera.matrixWorldInverse );
	_ssOrigin_3.applyMatrix4( projectionMatrix );
	_ssOrigin_3.multiplyScalar( 1 / _ssOrigin_3.w );

	// screen space
	_ssOrigin_3.x *= resolution.x / 2;
	_ssOrigin_3.y *= resolution.y / 2;
	_ssOrigin_3.z = 0;

	_ssOrigin3_3.copy( _ssOrigin_3 );

	_mvMatrix_3.multiplyMatrices( camera.matrixWorldInverse, matrixWorld );

	for ( let i = 0, l = segmentCount; i < l; i ++ ) {

		_start4_3.fromBufferAttribute( instanceStart, i );
		_end4_3.fromBufferAttribute( instanceEnd, i );

		_start4_3.w = 1;
		_end4_3.w = 1;

		// camera space
		_start4_3.applyMatrix4( _mvMatrix_3 );
		_end4_3.applyMatrix4( _mvMatrix_3 );

		// skip the segment if it's entirely behind the camera
		const isBehindCameraNear = _start4_3.z > near && _end4_3.z > near;
		if ( isBehindCameraNear ) {

			continue;

		}

		// trim the segment if it extends behind camera near
		if ( _start4_3.z > near ) {

			const deltaDist = _start4_3.z - _end4_3.z;
			const t = ( _start4_3.z - near ) / deltaDist;
			_start4_3.lerp( _end4_3, t );

		} else if ( _end4_3.z > near ) {

			const deltaDist = _end4_3.z - _start4_3.z;
			const t = ( _end4_3.z - near ) / deltaDist;
			_end4_3.lerp( _start4_3, t );

		}

		// clip space
		_start4_3.applyMatrix4( projectionMatrix );
		_end4_3.applyMatrix4( projectionMatrix );

		// ndc space [ - 1.0, 1.0 ]
		_start4_3.multiplyScalar( 1 / _start4_3.w );
		_end4_3.multiplyScalar( 1 / _end4_3.w );

		// screen space
		_start4_3.x *= resolution.x / 2;
		_start4_3.y *= resolution.y / 2;

		_end4_3.x *= resolution.x / 2;
		_end4_3.y *= resolution.y / 2;

		// create 2d segment
		_line_3.start.copy( _start4_3 );
		_line_3.start.z = 0;

		_line_3.end.copy( _end4_3 );
		_line_3.end.z = 0;

		// get closest point on ray to segment
		const param = _line_3.closestPointToPointParameter( _ssOrigin3_3, true );
		_line_3.at( param, _closestPoint_3 );

		// check if the intersection point is within clip space
		const zPos = MathUtils.lerp( _start4_3.z, _end4_3.z, param );
		const isInClipSpace = zPos >= - 1 && zPos <= 1;

		const isInside = _ssOrigin3_3.distanceTo( _closestPoint_3 ) < _lineWidth * 0.5;

		if ( isInClipSpace && isInside ) {

			_line_3.start.fromBufferAttribute( instanceStart, i );
			_line_3.end.fromBufferAttribute( instanceEnd, i );

			_line_3.start.applyMatrix4( matrixWorld );
			_line_3.end.applyMatrix4( matrixWorld );

			const pointOnLine = new Vector3();
			const point = new Vector3();

			_ray.distanceSqToSegment( _line_3.start, _line_3.end, point, pointOnLine );

			intersects.push( {
				point: point,
				pointOnLine: pointOnLine,
				distance: _ray.origin.distanceTo( point ),
				object: lineSegments,
				face: null,
				faceIndex: i,
				uv: null,
				uv1: null,
			} );

		}

	}

}

class LineSegments2 extends Mesh {

	constructor( geometry = new LineSegmentsGeometry(), material = new LineMaterial( { color: Math.random() * 0xffffff } ) ) {

		super( geometry, material );

		this.isLineSegments2 = true;

		this.type = 'LineSegments2';

	}

	// for backwards-compatibility, but could be a method of LineSegmentsGeometry...

	computeLineDistances() {

		const geometry = this.geometry;

		const instanceStart = geometry.attributes.instanceStart;
		const instanceEnd = geometry.attributes.instanceEnd;
		const lineDistances = new Float32Array( 2 * instanceStart.count );

		for ( let i = 0, j = 0, l = instanceStart.count; i < l; i ++, j += 2 ) {

			_start_3.fromBufferAttribute( instanceStart, i );
			_end_3.fromBufferAttribute( instanceEnd, i );

			lineDistances[ j ] = ( j === 0 ) ? 0 : lineDistances[ j - 1 ];
			lineDistances[ j + 1 ] = lineDistances[ j ] + _start_3.distanceTo( _end_3 );

		}

		const instanceDistanceBuffer = new InstancedInterleavedBuffer( lineDistances, 2, 1 ); // d0, d1

		geometry.setAttribute( 'instanceDistanceStart', new InterleavedBufferAttribute( instanceDistanceBuffer, 1, 0 ) ); // d0
		geometry.setAttribute( 'instanceDistanceEnd', new InterleavedBufferAttribute( instanceDistanceBuffer, 1, 1 ) ); // d1

		return this;

	}

	raycast( raycaster, intersects ) {

		const worldUnits = this.material.worldUnits;
		const camera = raycaster.camera;

		if ( camera === null && ! worldUnits ) {

			console.error( 'LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.' );

		}

		const threshold = ( raycaster.params.Line2 !== undefined ) ? raycaster.params.Line2.threshold || 0 : 0;

		_ray = raycaster.ray;

		const matrixWorld = this.matrixWorld;
		const geometry = this.geometry;
		const material = this.material;

		_lineWidth = material.linewidth + threshold;

		// check if we intersect the sphere bounds
		if ( geometry.boundingSphere === null ) {

			geometry.computeBoundingSphere();

		}

		_sphere_3.copy( geometry.boundingSphere ).applyMatrix4( matrixWorld );

		// increase the sphere bounds by the worst case line screen space width
		let sphereMargin;
		if ( worldUnits ) {

			sphereMargin = _lineWidth * 0.5;

		} else {

			const distanceToSphere = Math.max( camera.near, _sphere_3.distanceToPoint( _ray.origin ) );
			sphereMargin = getWorldSpaceHalfWidth( camera, distanceToSphere, material.resolution );

		}

		_sphere_3.radius += sphereMargin;

		if ( _ray.intersectsSphere( _sphere_3 ) === false ) {

			return;

		}

		// check if we intersect the box bounds
		if ( geometry.boundingBox === null ) {

			geometry.computeBoundingBox();

		}

		_box_3.copy( geometry.boundingBox ).applyMatrix4( matrixWorld );

		// increase the box bounds by the worst case line width
		let boxMargin;
		if ( worldUnits ) {

			boxMargin = _lineWidth * 0.5;

		} else {

			const distanceToBox = Math.max( camera.near, _box_3.distanceToPoint( _ray.origin ) );
			boxMargin = getWorldSpaceHalfWidth( camera, distanceToBox, material.resolution );

		}

		_box_3.expandByScalar( boxMargin );

		if ( _ray.intersectsBox( _box_3 ) === false ) {

			return;

		}

		if ( worldUnits ) {

			raycastWorldUnits( this, intersects );

		} else {

			raycastScreenSpace( this, camera, intersects );

		}

	}

}

export { LineSegments2 };

/* ---- Line2.js ---- */
class Line2 extends LineSegments2 {

	constructor( geometry = new LineGeometry(), material = new LineMaterial( { color: Math.random() * 0xffffff } ) ) {

		super( geometry, material );

		this.isLine2 = true;

		this.type = 'Line2';

	}

}

export { Line2 };
