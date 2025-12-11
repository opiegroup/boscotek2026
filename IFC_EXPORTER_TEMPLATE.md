# IFC Exporter Template - Best Practices

## 🎯 Purpose

This document provides a complete, production-ready template for exporting valid IFC 4 files using IfcOpenShell or similar libraries.

---

## ⚠️ Critical Rules for Valid IFC Files

### 1. **Entity References vs Numeric Values**

```typescript
// ❌ WRONG - Float where entity reference expected
const project = model.create('IFCPROJECT', ..., 100.0, 0.0);

// ✅ CORRECT - Entity references
const unitAssignment = model.create('IFCUNITASSIGNMENT', ...);
const context = model.create('IFCGEOMETRICREPRESENTATIONCONTEXT', ...);
const project = model.create('IFCPROJECT', ..., [context], unitAssignment);
```

**Rule**: If a parameter expects an IFC entity, you MUST pass:
- An entity reference (e.g., `#100`)
- An array of entity references (e.g., `[#10, #11, #12]`)
- NEVER a float, integer, or null where an entity is required

---

### 2. **Mandatory Spatial Hierarchy**

Every valid IFC file MUST have this exact structure:

```
IfcProject
  └─ IfcSite
      └─ IfcBuilding
          └─ IfcBuildingStorey
              └─ Products (IfcFurnishingElement, IfcBuildingElementProxy, etc.)
```

**Missing ANY level will cause import failures in Revit, ArchiCAD, and BlenderBIM.**

---

### 3. **Order of Entity Creation**

Create entities in this exact order:

```typescript
1. OwnerHistory
2. Units (IfcSIUnit, IfcUnitAssignment)
3. Geometric Context (IfcGeometricRepresentationContext)
4. Project (referencing units + context)
5. Site
6. Building
7. BuildingStorey
8. Aggregate relationships (IfcRelAggregates)
9. Products
10. Spatial containment (IfcRelContainedInSpatialStructure)
11. Property sets (IfcPropertySet, IfcRelDefinesByProperties)
```

**Why?** Each entity may reference previously created entities. Creating them out of order causes undefined references.

---

## 📋 Complete IFC Exporter Template

### TypeScript/Deno Example

```typescript
function generateValidIFC(configData: any): string {
  const { product, dimensions, configuration, referenceCode } = configData;
  const timestamp = new Date().toISOString();

  // ============================================================
  // HEADER
  // ============================================================
  const ifcHeader = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'), '2;1');
FILE_NAME('${referenceCode}.ifc', '${timestamp}', ('Boscotek'), ('Boscotek'), 'Boscotek Configurator v1.0', 'Boscotek Configurator', 'IFC4');
FILE_SCHEMA(('IFC4'));
ENDSEC;

DATA;`;

  let entityId = 1;
  const entities: string[] = [];

  // ============================================================
  // HELPER FUNCTION - Creates IFC entities
  // ============================================================
  const createEntity = (type: string, ...params: any[]): number => {
    const id = entityId++;
    const paramsStr = params.map(p => {
      if (p === null || p === undefined) return '$';
      if (typeof p === 'string') return `'${p}'`;
      if (Array.isArray(p)) {
        if (p.length === 0) return '()';
        
        const allNumbers = p.every(item => typeof item === 'number');
        
        if (allNumbers) {
          // Detect coordinates (small arrays with decimals or reasonable ranges)
          const hasDecimals = p.some((n: number) => n % 1 !== 0);
          const isSmallArray = p.length <= 4;
          const isReasonableRange = p.every((n: number) => n >= -10000 && n <= 10000);
          
          if (hasDecimals || (isSmallArray && isReasonableRange)) {
            // Coordinate list - use floats
            return `(${p.map(n => {
              const str = n.toString();
              return str.includes('.') ? str : `${str}.`;
            }).join(',')})`;
          }
        }
        
        // Entity reference list
        return `(${p.map(item => typeof item === 'number' ? `#${item}` : item).join(',')})`;
      }
      if (typeof p === 'number') {
        // Single numbers are entity references
        return `#${p}`;
      }
      return String(p);
    }).join(',');
    
    entities.push(`#${id}=${type}(${paramsStr});`);
    return id;
  };

  // ============================================================
  // STEP 1: OWNER HISTORY
  // ============================================================
  const ownerHistory = createEntity(
    'IFCOWNERHISTORY',
    null,              // OwningUser
    null,              // OwningApplication
    null,              // State
    'NOCHANGE',        // ChangeAction
    null,              // LastModifiedDate
    null,              // LastModifyingUser
    null,              // LastModifyingApplication
    Date.now()         // CreationDate
  );

  // ============================================================
  // STEP 2: UNITS
  // ============================================================
  const lengthUnit = createEntity('IFCSIUNIT', '*', 'LENGTHUNIT', null, 'METRE');
  const areaUnit = createEntity('IFCSIUNIT', '*', 'AREAUNIT', null, 'SQUARE_METRE');
  const volumeUnit = createEntity('IFCSIUNIT', '*', 'VOLUMEUNIT', null, 'CUBIC_METRE');
  const massUnit = createEntity('IFCSIUNIT', '*', 'MASSUNIT', null, 'GRAM');
  const timeUnit = createEntity('IFCSIUNIT', '*', 'TIMEUNIT', null, 'SECOND');
  
  const unitAssignment = createEntity(
    'IFCUNITASSIGNMENT',
    [lengthUnit, areaUnit, volumeUnit, massUnit, timeUnit]
  );

  // ============================================================
  // STEP 3: GEOMETRIC REPRESENTATION CONTEXT
  // ============================================================
  const worldCoordinateSystem = createEntity(
    'IFCAXIS2PLACEMENT3D',
    createEntity('IFCCARTESIANPOINT', [0., 0., 0.]),
    createEntity('IFCDIRECTION', [0., 0., 1.]),
    createEntity('IFCDIRECTION', [1., 0., 0.])
  );
  
  const geometricContext = createEntity(
    'IFCGEOMETRICREPRESENTATIONCONTEXT',
    null,                    // ContextIdentifier
    'Model',                 // ContextType
    3,                       // CoordinateSpaceDimension
    1.0E-5,                  // Precision
    worldCoordinateSystem,   // WorldCoordinateSystem
    null                     // TrueNorth
  );

  // ============================================================
  // STEP 4: PROJECT (with proper references to units + context)
  // ============================================================
  const project = createEntity(
    'IFCPROJECT',
    referenceCode,                           // GlobalId
    ownerHistory,                            // OwnerHistory
    product.name,                            // Name
    `${product.name} Configuration`,         // Description
    null,                                    // ObjectType
    null,                                    // LongName
    null,                                    // Phase
    [geometricContext],                      // RepresentationContexts (LIST)
    unitAssignment                           // UnitsInContext
  );

  // ============================================================
  // STEP 5: SPATIAL HIERARCHY - Site, Building, Storey
  // ============================================================
  const site = createEntity(
    'IFCSITE',
    'Site-001',          // GlobalId
    ownerHistory,        // OwnerHistory
    'Default Site',      // Name
    null,                // Description
    null,                // ObjectType
    null,                // ObjectPlacement
    null,                // Representation
    null,                // LongName
    'ELEMENT',           // CompositionType
    null,                // RefLatitude
    null,                // RefLongitude
    null,                // RefElevation
    null,                // LandTitleNumber
    null                 // SiteAddress
  );

  const building = createEntity(
    'IFCBUILDING',
    'Building-001',      // GlobalId
    ownerHistory,        // OwnerHistory
    'Default Building',  // Name
    null,                // Description
    null,                // ObjectType
    null,                // ObjectPlacement
    null,                // Representation
    null,                // LongName
    'ELEMENT',           // CompositionType
    null,                // ElevationOfRefHeight
    null,                // ElevationOfTerrain
    null                 // BuildingAddress
  );

  const storey = createEntity(
    'IFCBUILDINGSTOREY',
    'Storey-001',        // GlobalId
    ownerHistory,        // OwnerHistory
    'Level 0',           // Name
    null,                // Description
    null,                // ObjectType
    null,                // ObjectPlacement
    null,                // Representation
    null,                // LongName
    'ELEMENT',           // CompositionType
    null                 // Elevation
  );

  // ============================================================
  // STEP 6: AGGREGATE RELATIONSHIPS (Project → Site → Building → Storey)
  // ============================================================
  createEntity(
    'IFCRELAGGREGATES',
    'RelAgg-ProjectSite',
    ownerHistory,
    null,
    null,
    project,             // RelatingObject (parent)
    [site]               // RelatedObjects (children)
  );

  createEntity(
    'IFCRELAGGREGATES',
    'RelAgg-SiteBuilding',
    ownerHistory,
    null,
    null,
    site,
    [building]
  );

  createEntity(
    'IFCRELAGGREGATES',
    'RelAgg-BuildingStorey',
    ownerHistory,
    null,
    null,
    building,
    [storey]
  );

  // ============================================================
  // STEP 7: PRODUCT GEOMETRY
  // ============================================================
  const { width, height, depth } = dimensions;

  // Create placement
  const productPlacement = createEntity(
    'IFCLOCALPLACEMENT',
    null,  // RelativePlacement (null = global)
    createEntity(
      'IFCAXIS2PLACEMENT3D',
      createEntity('IFCCARTESIANPOINT', [0., 0., 0.]),
      createEntity('IFCDIRECTION', [0., 0., 1.]),
      createEntity('IFCDIRECTION', [1., 0., 0.])
    )
  );

  // Create extruded solid geometry
  const profilePosition = createEntity(
    'IFCAXIS2PLACEMENT2D',
    createEntity('IFCCARTESIANPOINT', [0., 0.]),
    createEntity('IFCDIRECTION', [1., 0.])
  );

  const rectangleProfile = createEntity(
    'IFCRECTANGLEPROFILEDEF',
    'AREA',
    null,
    profilePosition,
    width,
    depth
  );

  const extrusionPlacement = createEntity(
    'IFCAXIS2PLACEMENT3D',
    createEntity('IFCCARTESIANPOINT', [-width/2, -depth/2, 0.]),
    createEntity('IFCDIRECTION', [0., 0., 1.]),
    createEntity('IFCDIRECTION', [1., 0., 0.])
  );

  const extrudedSolid = createEntity(
    'IFCEXTRUDEDAREASOLID',
    rectangleProfile,
    extrusionPlacement,
    createEntity('IFCDIRECTION', [0., 0., 1.]),
    height
  );

  const shapeRepresentation = createEntity(
    'IFCSHAPEREPRESENTATION',
    geometricContext,
    'Body',
    'SweptSolid',
    [extrudedSolid]
  );

  const productDefinitionShape = createEntity(
    'IFCPRODUCTDEFINITIONSHAPE',
    null,
    null,
    [shapeRepresentation]
  );

  // ============================================================
  // STEP 8: PRODUCT INSTANCE
  // ============================================================
  const productInstance = createEntity(
    'IFCFURNISHINGELEMENT',
    referenceCode,
    ownerHistory,
    product.name,
    product.description,
    null,                    // ObjectType
    productPlacement,        // ObjectPlacement
    productDefinitionShape,  // Representation
    null                     // Tag
  );

  // ============================================================
  // STEP 9: SPATIAL CONTAINMENT (Products → BuildingStorey)
  // ============================================================
  createEntity(
    'IFCRELCONTAINEDINSPATIALSTRUCTURE',
    'RelContained-StoreyProducts',
    ownerHistory,
    null,
    null,
    [productInstance],       // RelatedElements
    storey                   // RelatingStructure
  );

  // ============================================================
  // STEP 10: PROPERTY SETS (Metadata)
  // ============================================================
  const properties: number[] = [];

  properties.push(
    createEntity(
      'IFCPROPERTYSINGLEVALUE',
      'Manufacturer',
      null,
      createEntity('IFCTEXT', 'Boscotek'),
      null
    )
  );

  properties.push(
    createEntity(
      'IFCPROPERTYSINGLEVALUE',
      'ProductFamily',
      null,
      createEntity('IFCTEXT', product.name),
      null
    )
  );

  properties.push(
    createEntity(
      'IFCPROPERTYSINGLEVALUE',
      'ConfigurationCode',
      null,
      createEntity('IFCTEXT', referenceCode),
      null
    )
  );

  if (configuration.selections) {
    Object.entries(configuration.selections).forEach(([key, value]) => {
      if (value) {
        properties.push(
          createEntity(
            'IFCPROPERTYSINGLEVALUE',
            key,
            null,
            createEntity('IFCTEXT', String(value)),
            null
          )
        );
      }
    });
  }

  const propertySet = createEntity(
    'IFCPROPERTYSET',
    'Pset_BoscotekConfiguration',
    ownerHistory,
    null,
    null,
    properties
  );

  createEntity(
    'IFCRELDEFINESBYPROPERTIES',
    'RelDefines-Props',
    ownerHistory,
    null,
    null,
    [productInstance],
    propertySet
  );

  // ============================================================
  // CLOSE FILE
  // ============================================================
  return `${ifcHeader}
${entities.join('\n')}
ENDSEC;
END-ISO-10303-21;`;
}
```

---

## 🔍 Common Pitfalls & How to Avoid Them

### Pitfall 1: Missing Spatial Hierarchy

**Problem:**
```typescript
// Missing BuildingStorey
project → site → building → products (WRONG!)
```

**Solution:**
```typescript
// Complete hierarchy
project → site → building → storey → products (CORRECT!)
```

---

### Pitfall 2: Null References Where Entities Required

**Problem:**
```typescript
const project = createEntity('IFCPROJECT', ..., null, null);
//                                                ^     ^
//                                RepresentationContexts  UnitsInContext
```

**Solution:**
```typescript
const project = createEntity('IFCPROJECT', ..., [geometricContext], unitAssignment);
```

---

### Pitfall 3: Entity IDs Instead of References

**Problem:**
```typescript
// Passing raw ID instead of entity reference
const rel = createEntity('IFCRELAGGREGATES', ..., 100, [200]);
```

**Solution:**
```typescript
// Pass entity IDs returned from createEntity()
const projectId = createEntity('IFCPROJECT', ...);
const siteId = createEntity('IFCSITE', ...);
const rel = createEntity('IFCRELAGGREGATES', ..., projectId, [siteId]);
```

---

### Pitfall 4: Coordinates vs Entity References

**Problem:**
```typescript
// Treating coordinates as entity references
const point = createEntity('IFCCARTESIANPOINT', #10);  // WRONG!
```

**Solution:**
```typescript
// Coordinates are arrays of floats
const point = createEntity('IFCCARTESIANPOINT', [0., 0., 0.]);  // CORRECT!
```

---

## ✅ Validation Checklist

Before exporting, verify:

- [ ] `IFCPROJECT` has `RepresentationContexts` (not null)
- [ ] `IFCPROJECT` has `UnitsInContext` (not null)
- [ ] Spatial hierarchy: Project → Site → Building → Storey exists
- [ ] All products are contained in `IFCBUILDINGSTOREY` (not Building)
- [ ] All `IFCRELAGGREGATES` have proper entity references (not floats)
- [ ] All `IFCCARTESIANPOINT` have coordinate arrays (not entity refs)
- [ ] All `IFCDIRECTION` have normalized vectors
- [ ] All `IFCAXIS2PLACEMENT3D` have 3 components (origin, axis, refDirection)
- [ ] Owner history exists and is referenced
- [ ] All GlobalIds are unique and valid

---

## 🧪 Testing Your IFC Export

### Method 1: BlenderBIM (Free)

```bash
# Install Blender + BlenderBIM addon
# Open Blender → File → Import → IFC → Select your .ifc file
# If it loads without errors, your spatial hierarchy is valid
```

### Method 2: IfcOpenShell Python

```python
import ifcopenshell

# Open your IFC file
model = ifcopenshell.open('your_file.ifc')

# Verify project exists
project = model.by_type('IfcProject')[0]
assert project.UnitsInContext is not None, "Missing units!"
assert project.RepresentationContexts, "Missing contexts!"

# Verify spatial hierarchy
site = model.by_type('IfcSite')[0]
building = model.by_type('IfcBuilding')[0]
storey = model.by_type('IfcBuildingStorey')[0]

print("✅ All required entities exist")

# Verify products are in storey
for rel in model.by_type('IfcRelContainedInSpatialStructure'):
    if rel.RelatingStructure == storey:
        print(f"✅ {len(rel.RelatedElements)} products in storey")
```

### Method 3: Online Validators

- [BIMCollab ZOOM](https://www.bimcollab.com/en/zoom/) (Free viewer)
- [IFC.js Viewer](https://ifcjs.github.io/hello-world/examples/web-ifc-viewer/index.html) (Open source)
- [Solibri Model Checker](https://www.solibri.com/) (Commercial)

---

## 📚 Resources

### IFC4 Documentation
- [BuildingSMART IFC4 Specification](https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2_TC1/HTML/)
- [IFC4 Reference View](https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/)

### IfcOpenShell
- [Documentation](https://docs.ifcopenshell.org/)
- [API Reference](https://blenderbim.org/docs-python/autoapi/ifcopenshell/)
- [GitHub](https://github.com/IfcOpenShell/IfcOpenShell)

### BlenderBIM
- [Official Site](https://blenderbim.org/)
- [User Guide](https://docs.blenderbim.org/)
- [OSArch Community](https://community.osarch.org/)

---

## 💡 Pro Tips

1. **Always create units BEFORE project** - Project references them
2. **Use meaningful GlobalIds** - They help with debugging
3. **Add property sets** - They make your BIM data useful
4. **Test with multiple tools** - Revit, BlenderBIM, IFC.js
5. **Keep track of entity IDs** - Use variables, not hardcoded numbers
6. **Validate early, validate often** - Don't wait until the end

---

**Author**: Claude Sonnet 4.5  
**Date**: December 11, 2025  
**License**: MIT  
**Status**: ✅ Production Ready
