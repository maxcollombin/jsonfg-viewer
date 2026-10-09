import { LineParser } from '../geometry/LineParser.js';
import { PointParser } from '../geometry/PointParser.js';
import { TriangleParser } from '../geometry/TriangleParser.js';

export class ChunkParser {

	constructor() {

		this.matrix = null;
		this.chunkSize = 2000;

		this.lods = [];
		this.objectColors = {};
		this.surfaceColors = {};

		this.onchunkload = null;
		this.onComplete = null;

	}

	parse( data ) {

		let i = 0;
		const geometryParsers = [
			new TriangleParser( data, Object.keys( data.features ), this.objectColors ),
			new LineParser( data, Object.keys( data.features ), this.objectColors ),
			new PointParser( data, Object.keys( data.features ), this.objectColors )
		];
		

		for ( const objectId in data.features ) {

			const cityObject = data.features[ objectId ];
			
			// parse jsonfg geometry
			if ( cityObject.geometry ) {

				for ( const geometryParser of geometryParsers ) {
					geometryParser.lods = this.lods;
					geometryParser.parseGeometry( cityObject.geometry, objectId, "geometry" );
					this.lods = geometryParser.lods;

				}


			}

			// parse jsonfg place
			if ( cityObject.place ) {

				for ( const geometryParser of geometryParsers ) {
					geometryParser.lods = this.lods;
					geometryParser.parseGeometry( cityObject.place, objectId, "place" );
					this.lods = geometryParser.lods;

				}


			}

			if ( i ++ > this.chunkSize ) {

				for ( const geometryParser of geometryParsers ) {

					this.returnObjects( geometryParser, data );

					geometryParser.clean();

				}

				i = 0;

			}

		}

		for ( const geometryParser of geometryParsers ) {

			// TODO: fix the "finished" flag here - probably better be a
			// different callback
			this.returnObjects( geometryParser, data );

			geometryParser.clean();

		}

		// TODO: this needs some fix - probably a common configuration class
		// shared between the parsers
		this.objectColors = geometryParsers[ 0 ].objectColors;
		this.surfaceColors = geometryParsers[ 0 ].surfaceColors;

		if ( this.onComplete ) {

			this.onComplete();

		}

	}

	returnObjects( parser, data ) {

		if ( parser.geomData.count() > 0 ) {

			this.onchunkload( parser.geomData.getVertices(),
							  parser.geomData.toObject(),
							  parser.lods,
							  parser.objectColors);
							  // parser.surfaceColors );

		}

	}

}
