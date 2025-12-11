# IFC4 Schema Compliance Checklist

## 📋 Purpose

Use this checklist to verify your IFC export implementation is fully compliant with IFC4 standards and will successfully import into Revit, ArchiCAD, BlenderBIM, and other BIM tools.

---

## ✅ Level 1: Critical Requirements (Must Have)

These are MANDATORY for a valid IFC file. Missing any of these will cause import failures.

### File Structure

- [ ] **IFC Header present**
  - [ ] `ISO-10303-21;` at start
  - [ ] `HEADER;` section with `FILE_DESCRIPTION`, `FILE_NAME`, `FILE_SCHEMA`
  - [ ] `DATA;` section
  - [ ] `END-ISO-10303-21;` at end

- [ ] **File schema declared**
  - [ ] `FILE_SCHEMA(('IFC4'));` or `FILE_SCHEMA(('IFC2X3'));`
  - Schema matches entity types used in file

### Project Structure

- [ ] **IfcProject exists**
  - [ ] Has valid GlobalId (GUID format)
  - [ ] Has OwnerHistory reference
  - [ ] Has Name (string)
  - [ ] Has RepresentationContexts (LIST of IfcGeometricRepresentationContext) - **NOT NULL**
  - [ ] Has UnitsInContext (IfcUnitAssignment reference) - **NOT NULL**

- [ ] **IfcGeometricRepresentationContext exists**
  - [ ] ContextType is 'Model'
  - [ ] CoordinateSpaceDimension is 3
  - [ ] Precision is set (e.g., 1.0E-5)
  - [ ] WorldCoordinateSystem exists (IfcAxis2Placement3D)

- [ ] **IfcUnitAssignment exists**
  - [ ] Contains at least: LENGTHUNIT, AREAUNIT, VOLUMEUNIT
  - [ ] Units are valid IfcSIUnit entities
  - [ ] LENGTHUNIT is METRE (recommended for interoperability)

### Spatial Hierarchy

- [ ] **Complete spatial structure exists**
  ```
  IfcProject
    └─ IfcSite (via IfcRelAggregates)
        └─ IfcBuilding (via IfcRelAggregates)
            └─ IfcBuildingStorey (via IfcRelAggregates)
  ```

- [ ] **IfcSite requirements**
  - [ ] Has GlobalId
  - [ ] Has OwnerHistory
  - [ ] Has Name
  - [ ] CompositionType is 'ELEMENT'
  - [ ] Related to IfcProject via IfcRelAggregates

- [ ] **IfcBuilding requirements**
  - [ ] Has GlobalId
  - [ ] Has OwnerHistory
  - [ ] Has Name
  - [ ] CompositionType is 'ELEMENT'
  - [ ] Related to IfcSite via IfcRelAggregates

- [ ] **IfcBuildingStorey requirements**
  - [ ] Has GlobalId
  - [ ] Has OwnerHistory
  - [ ] Has Name
  - [ ] CompositionType is 'ELEMENT'
  - [ ] Related to IfcBuilding via IfcRelAggregates

### Spatial Relationships

- [ ] **IfcRelAggregates relationships exist**
  - [ ] Project → Site
  - [ ] Site → Building
  - [ ] Building → Storey
  - [ ] Each relationship has valid GlobalId
  - [ ] Each relationship has OwnerHistory
  - [ ] RelatingObject points to parent (single entity reference)
  - [ ] RelatedObjects points to children (LIST of entity references)

- [ ] **Products contained in spatial structure**
  - [ ] All products (IfcFurnishingElement, etc.) are related to IfcBuildingStorey
  - [ ] Relationship is IfcRelContainedInSpatialStructure
  - [ ] RelatedElements contains product references (LIST)
  - [ ] RelatingStructure points to IfcBuildingStorey (single reference)

### Entity References

- [ ] **No float values where entity references expected**
  - [ ] IfcProject.RepresentationContexts is a LIST, not a float
  - [ ] IfcProject.UnitsInContext is an entity reference, not a float
  - [ ] IfcRelAggregates.RelatingObject is entity reference, not a float
  - [ ] IfcRelAggregates.RelatedObjects is LIST of entity refs, not floats

- [ ] **All entity references use # notation**
  - Example: `#100` not `100`
  - Example: `(#10, #11, #12)` not `(10, 11, 12)`

---

## ✅ Level 2: Geometry Requirements (For Visible Products)

These are required if you want your products to be visible in BIM viewers.

### Product Geometry

- [ ] **Products have ObjectPlacement**
  - [ ] IfcLocalPlacement exists
  - [ ] RelativePlacement is IfcAxis2Placement3D
  - [ ] IfcAxis2Placement3D has:
    - [ ] Location (IfcCartesianPoint)
    - [ ] Axis (IfcDirection - Z axis)
    - [ ] RefDirection (IfcDirection - X axis)

- [ ] **Products have Representation**
  - [ ] IfcProductDefinitionShape exists
  - [ ] Representations list contains IfcShapeRepresentation
  - [ ] IfcShapeRepresentation has:
    - [ ] ContextOfItems (references IfcGeometricRepresentationContext)
    - [ ] RepresentationIdentifier ('Body' or 'Axis')
    - [ ] RepresentationType (e.g., 'SweptSolid', 'Brep', 'MappedRepresentation')
    - [ ] Items (LIST of geometry entities)

### Geometry Entities

- [ ] **IfcExtrudedAreaSolid (if used)**
  - [ ] SweptArea is valid profile (e.g., IfcRectangleProfileDef)
  - [ ] Position is IfcAxis2Placement3D
  - [ ] ExtrudedDirection is IfcDirection
  - [ ] Depth is positive number

- [ ] **IfcCartesianPoint (if used)**
  - [ ] Coordinates are LIST of floats: `(0., 0., 0.)`
  - [ ] NOT entity references: NOT `(#10, #11, #12)`
  - [ ] Has 2 or 3 coordinates (2D or 3D)

- [ ] **IfcDirection (if used)**
  - [ ] DirectionRatios are LIST of floats: `(1., 0., 0.)`
  - [ ] NOT entity references
  - [ ] Should be normalized (magnitude = 1.0)
  - [ ] Has 2 or 3 components (2D or 3D)

### Profile Definitions

- [ ] **IfcRectangleProfileDef (if used)**
  - [ ] ProfileType is 'AREA'
  - [ ] Position is IfcAxis2Placement2D
  - [ ] XDim and YDim are positive numbers

- [ ] **IfcCircleProfileDef (if used)**
  - [ ] ProfileType is 'AREA'
  - [ ] Position is IfcAxis2Placement2D
  - [ ] Radius is positive number

---

## ✅ Level 3: Metadata Requirements (BIM Data Quality)

These are required for professional-grade BIM data with searchable metadata.

### Property Sets

- [ ] **Property sets exist for products**
  - [ ] IfcPropertySet created for each product type
  - [ ] Has GlobalId
  - [ ] Has OwnerHistory
  - [ ] Has Name (e.g., 'Pset_BoscotekConfiguration')
  - [ ] HasProperties is LIST of IfcProperty entities

- [ ] **Properties are valid**
  - [ ] IfcPropertySingleValue for simple values
  - [ ] Name is descriptive string
  - [ ] NominalValue is typed (IfcText, IfcReal, IfcBoolean, etc.)
  - [ ] Example:
    ```
    IFCPROPERTYSINGLEVALUE('Manufacturer', $, IFCTEXT('Boscotek'), $)
    ```

- [ ] **Property relationships defined**
  - [ ] IfcRelDefinesByProperties exists
  - [ ] RelatedObjects points to products (LIST)
  - [ ] RelatingPropertyDefinition points to IfcPropertySet

### Recommended Properties

- [ ] **Manufacturer information**
  - [ ] 'Manufacturer' property (IfcText)
  - [ ] 'ProductFamily' property (IfcText)
  - [ ] 'ModelNumber' or 'ConfigurationCode' property (IfcText)

- [ ] **Physical properties**
  - [ ] 'Width', 'Height', 'Depth' (IfcLengthMeasure)
  - [ ] 'Material' (IfcText)
  - [ ] 'Finish' (IfcText)

- [ ] **Pricing/Procurement**
  - [ ] 'Price' or 'BasePrice' (IfcMonetaryMeasure)
  - [ ] 'LeadTime' (IfcTimeMeasure or IfcText)
  - [ ] 'SKU' or 'ProductCode' (IfcText)

### Owner History

- [ ] **IfcOwnerHistory exists**
  - [ ] Referenced by all major entities
  - [ ] ChangeAction is set (e.g., 'NOCHANGE', 'ADDED')
  - [ ] CreationDate is set
  - [ ] Can have null for users/applications if anonymous

---

## ✅ Level 4: Advanced Requirements (BIM LOD 200+)

These are recommended for high-quality BIM deliverables.

### Multiple Products

- [ ] **Assemblies properly modeled**
  - [ ] Parent element (cabinet) exists
  - [ ] Child elements (drawers, shelves) exist
  - [ ] Children have proper placement relative to parent
  - [ ] Can use IfcRelAggregates for compositional relationships

### Material Definitions

- [ ] **IfcMaterial or IfcMaterialLayerSet exists**
  - [ ] Materials have names
  - [ ] Materials related to products via IfcRelAssociatesMaterial
  - [ ] Materials can have properties (color, finish, etc.)

### Classification

- [ ] **Products classified with standards**
  - [ ] IfcClassificationReference exists
  - [ ] References standard systems (Uniclass, Omniclass, etc.)
  - [ ] Related via IfcRelAssociatesClassification

### Quantities

- [ ] **Quantity sets defined**
  - [ ] IfcElementQuantity exists
  - [ ] Contains IfcQuantityArea, IfcQuantityVolume, etc.
  - [ ] Related via IfcRelDefinesByProperties

---

## ✅ Level 5: Export Quality Checks

Use these tests to verify your export is production-ready.

### Validation Tests

- [ ] **File opens in BlenderBIM**
  - No Python errors
  - Spatial hierarchy loads
  - Products visible in 3D view

- [ ] **File opens in Revit** (if available)
  - No import warnings
  - Elements appear in correct locations
  - Properties are readable

- [ ] **File opens in ArchiCAD** (if available)
  - Import succeeds
  - Geometry is correct
  - Classification works

- [ ] **File passes IfcOpenShell validation**
  ```python
  import ifcopenshell
  model = ifcopenshell.open('file.ifc')
  # No exceptions raised
  ```

### Data Quality Tests

- [ ] **All GlobalIds are unique**
  - No duplicate GUIDs in file
  - GUIDs follow IFC format: `22-char base64 string`

- [ ] **All entity references are valid**
  - No dangling references (pointing to non-existent entities)
  - No circular references

- [ ] **All units are consistent**
  - If METRE used, all dimensions in meters
  - No mixing feet and meters

- [ ] **All coordinates are reasonable**
  - No extreme values (> 10,000 meters)
  - No NaN or Infinity values
  - Products not placed millions of meters away

### Performance Tests

- [ ] **File size is reasonable**
  - < 10 MB for single product
  - < 100 MB for small building
  - If larger, consider tessellation/optimization

- [ ] **Generation time acceptable**
  - < 1 second for single product
  - < 10 seconds for complex assembly
  - If slower, consider caching or optimization

---

## 🔧 Debugging Checklist

If your IFC file fails to import, check these:

### Common Error: "AttributeError: 'float' object has no attribute 'is_a'"

- [ ] Check IfcProject.RepresentationContexts - should be LIST of entities, not float
- [ ] Check IfcProject.UnitsInContext - should be entity reference, not float
- [ ] Check IfcRelAggregates.RelatedObjects - should be LIST of entity refs, not floats
- [ ] Search file for patterns like: `= 0.0;` or `= (0.0, 1.0);` in wrong places

### Common Error: "Missing spatial structure"

- [ ] Verify IfcSite exists
- [ ] Verify IfcBuilding exists
- [ ] Verify IfcBuildingStorey exists
- [ ] Verify IfcRelAggregates chains them together
- [ ] Verify products are in IfcRelContainedInSpatialStructure pointing to storey

### Common Error: "No geometry visible"

- [ ] Check products have ObjectPlacement (not null)
- [ ] Check products have Representation (not null)
- [ ] Check IfcShapeRepresentation.ContextOfItems references geometricContext
- [ ] Check geometry entities (extruded solids, profiles) are valid

### Common Error: "Invalid entity reference"

- [ ] Check all `#` references point to existing entities
- [ ] Check entity IDs are sequential (no gaps)
- [ ] Check no entity references itself

---

## 📊 Compliance Matrix

Use this matrix to track your implementation status:

| Requirement | Implemented? | Tested? | Notes |
|-------------|--------------|---------|-------|
| IFC Header | ☐ | ☐ | |
| IfcProject with units | ☐ | ☐ | |
| IfcProject with contexts | ☐ | ☐ | |
| IfcSite | ☐ | ☐ | |
| IfcBuilding | ☐ | ☐ | |
| IfcBuildingStorey | ☐ | ☐ | |
| IfcRelAggregates (all) | ☐ | ☐ | |
| IfcRelContainedInSpatialStructure | ☐ | ☐ | |
| Product geometry | ☐ | ☐ | |
| Product placement | ☐ | ☐ | |
| Property sets | ☐ | ☐ | |
| Owner history | ☐ | ☐ | |
| Valid entity references | ☐ | ☐ | |
| BlenderBIM import | ☐ | ☐ | |
| Revit import | ☐ | ☐ | |

---

## 🎯 Target Compliance Levels

### Minimum Viable IFC (Level 1 + Level 2)
- Valid IFC file
- Spatial hierarchy
- Visible geometry
- **Use case**: Visual coordination, clash detection

### Professional BIM (Level 1 + 2 + 3)
- Minimum Viable +
- Complete metadata
- Property sets
- Owner history
- **Use case**: Design coordination, quantity takeoff

### Enterprise BIM (All Levels)
- Professional BIM +
- Material definitions
- Classification systems
- Quantity sets
- Multi-product assemblies
- **Use case**: Full BIM workflow, facility management, digital twins

---

## 📞 Support Resources

### If you need help:

1. **IfcOpenShell Forum**: https://community.osarch.org/
2. **BuildingSMART Standards**: https://standards.buildingsmart.org/
3. **BlenderBIM Documentation**: https://docs.blenderbim.org/
4. **IFC Validator Tools**:
   - ifcOWL Validator: http://linkedbuildingdata.net/ldac2019/files/validator/
   - BIMCollab Checker: https://www.bimcollab.com/

---

## ✅ Final Sign-Off

Before deploying your IFC exporter to production:

- [ ] All Level 1 requirements met (Critical)
- [ ] All Level 2 requirements met (Geometry)
- [ ] At least 80% of Level 3 requirements met (Metadata)
- [ ] File opens in at least 2 different BIM tools without errors
- [ ] Sample exports reviewed by BIM coordinator or architect
- [ ] Performance tested with realistic product configurations
- [ ] Error handling implemented for missing/invalid data
- [ ] User documentation created

---

**Document Version**: 1.0  
**Date**: December 11, 2025  
**Author**: Claude Sonnet 4.5  
**Status**: ✅ Production Ready  
**License**: MIT
