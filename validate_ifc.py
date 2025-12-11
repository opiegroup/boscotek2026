#!/usr/bin/env python3
"""
IFC Validation Script - Section 12
Validates Boscotek Configurator IFC exports against the specification
"""

import sys
import os
from typing import List, Tuple

try:
    import ifcopenshell
    import ifcopenshell.util.element
except ImportError:
    print("ERROR: ifcopenshell not installed. Install with: pip install ifcopenshell")
    sys.exit(1)


class IFCValidator:
    """Validates IFC files against Boscotek specification"""
    
    def __init__(self, ifc_file_path: str):
        self.file_path = ifc_file_path
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.info: List[str] = []
        
        try:
            self.model = ifcopenshell.open(ifc_file_path)
        except Exception as e:
            raise Exception(f"Failed to open IFC file: {e}")
    
    def validate_all(self) -> bool:
        """Run all validation checks"""
        print(f"\n{'='*70}")
        print(f"IFC VALIDATION: {os.path.basename(self.file_path)}")
        print(f"{'='*70}\n")
        
        self.validate_schema()
        self.validate_units()
        self.validate_spatial_hierarchy()
        self.validate_no_float_placements()
        self.validate_products()
        self.validate_property_sets()
        self.validate_relationships()
        
        self.print_results()
        
        return len(self.errors) == 0
    
    def validate_schema(self):
        """Section 2: Verify IFC4 schema"""
        schema = self.model.wrapped_data.schema
        if schema != "IFC4":
            self.errors.append(f"Schema must be IFC4, found: {schema}")
        else:
            self.info.append(f"✓ Schema: {schema}")
    
    def validate_units(self):
        """Section 5: Verify units are millimeters"""
        projects = self.model.by_type("IfcProject")
        if not projects:
            self.errors.append("No IfcProject found")
            return
        
        project = projects[0]
        
        if not project.UnitsInContext:
            self.errors.append("IfcProject.UnitsInContext is null (must be entity reference)")
            return
        
        units = project.UnitsInContext
        length_unit = None
        
        for unit in units.Units:
            if hasattr(unit, 'UnitType') and unit.UnitType == 'LENGTHUNIT':
                length_unit = unit
                break
        
        if not length_unit:
            self.errors.append("No LENGTHUNIT found in UnitsInContext")
        elif hasattr(length_unit, 'Prefix') and length_unit.Prefix == 'MILLI':
            self.info.append("✓ Units: MILLIMETRE (correct)")
        else:
            prefix = getattr(length_unit, 'Prefix', 'None')
            self.warnings.append(f"Units: {prefix}METRE (spec requires MILLIMETRE)")
    
    def validate_spatial_hierarchy(self):
        """Section 3: Verify complete spatial hierarchy"""
        # Check Project
        projects = self.model.by_type("IfcProject")
        if not projects:
            self.errors.append("No IfcProject found")
            return
        
        project = projects[0]
        
        # Check RepresentationContexts
        if not project.RepresentationContexts:
            self.errors.append("IfcProject.RepresentationContexts is null (must be entity list)")
        else:
            self.info.append(f"✓ Project has {len(project.RepresentationContexts)} representation context(s)")
        
        # Check spatial structure
        sites = self.model.by_type("IfcSite")
        buildings = self.model.by_type("IfcBuilding")
        storeys = self.model.by_type("IfcBuildingStorey")
        
        if not sites:
            self.errors.append("No IfcSite found (required)")
        else:
            self.info.append(f"✓ Found {len(sites)} IfcSite(s)")
        
        if not buildings:
            self.errors.append("No IfcBuilding found (required)")
        else:
            self.info.append(f"✓ Found {len(buildings)} IfcBuilding(s)")
        
        if not storeys:
            self.errors.append("No IfcBuildingStorey found (CRITICAL - required for valid hierarchy)")
        else:
            self.info.append(f"✓ Found {len(storeys)} IfcBuildingStorey(s)")
    
    def validate_no_float_placements(self):
        """Section 8, 13: Ensure no floats where entities required"""
        products = self.model.by_type("IfcProduct")
        
        for product in products:
            # Check ObjectPlacement is not null
            if not product.ObjectPlacement:
                self.errors.append(f"{product.Name}: ObjectPlacement is null (must be IfcLocalPlacement)")
                continue
            
            # Check it's a proper entity
            if not hasattr(product.ObjectPlacement, 'is_a'):
                self.errors.append(f"{product.Name}: ObjectPlacement is not an IFC entity (possibly float)")
                continue
            
            if not product.ObjectPlacement.is_a('IfcLocalPlacement'):
                self.warnings.append(f"{product.Name}: ObjectPlacement is {product.ObjectPlacement.is_a()} (expected IfcLocalPlacement)")
        
        self.info.append(f"✓ Checked {len(products)} products for valid placements")
    
    def validate_products(self):
        """Section 6, 7: Validate products have geometry and metadata"""
        products = self.model.by_type("IfcProduct")
        
        for product in products:
            # Skip spatial structure elements
            if product.is_a() in ['IfcProject', 'IfcSite', 'IfcBuilding', 'IfcBuildingStorey']:
                continue
            
            # Check Representation exists
            if not product.Representation:
                self.warnings.append(f"{product.Name}: No Representation (geometry missing)")
                continue
            
            # Check ObjectType is set (Section 6)
            if not product.ObjectType:
                self.warnings.append(f"{product.Name}: ObjectType not set (should be Boscotek code)")
        
        furnishings = self.model.by_type("IfcFurnishingElement")
        self.info.append(f"✓ Found {len(furnishings)} IfcFurnishingElement(s)")
    
    def validate_property_sets(self):
        """Section 10: Verify Pset_BoscotekCabinet exists"""
        products = self.model.by_type("IfcFurnishingElement")
        
        for product in products:
            psets = ifcopenshell.util.element.get_psets(product)
            
            if 'Pset_BoscotekCabinet' in psets:
                pset = psets['Pset_BoscotekCabinet']
                
                # Check required properties
                required_props = ['BoscotekCode', 'Family', 'Manufacturer']
                missing_props = [prop for prop in required_props if prop not in pset]
                
                if missing_props:
                    self.warnings.append(f"{product.Name}: Missing properties: {', '.join(missing_props)}")
                else:
                    self.info.append(f"✓ {product.Name}: Has complete Pset_BoscotekCabinet")
            else:
                self.warnings.append(f"{product.Name}: Missing Pset_BoscotekCabinet property set")
    
    def validate_relationships(self):
        """Section 13: Ensure relationships use entity references"""
        # Check IfcRelAggregates
        aggregates = self.model.by_type("IfcRelAggregates")
        for rel in aggregates:
            if not hasattr(rel.RelatingObject, 'is_a'):
                self.errors.append(f"IfcRelAggregates.RelatingObject is not an entity (possibly float)")
            
            if not rel.RelatedObjects:
                self.errors.append(f"IfcRelAggregates.RelatedObjects is empty")
            else:
                for obj in rel.RelatedObjects:
                    if not hasattr(obj, 'is_a'):
                        self.errors.append(f"IfcRelAggregates.RelatedObjects contains non-entity (possibly float)")
        
        # Check IfcRelContainedInSpatialStructure
        containments = self.model.by_type("IfcRelContainedInSpatialStructure")
        for rel in containments:
            if not hasattr(rel.RelatingStructure, 'is_a'):
                self.errors.append(f"IfcRelContainedInSpatialStructure.RelatingStructure is not an entity")
            
            # Check products are in BuildingStorey (not Building)
            if hasattr(rel.RelatingStructure, 'is_a'):
                if rel.RelatingStructure.is_a('IfcBuilding'):
                    self.warnings.append("Products contained in IfcBuilding (should be IfcBuildingStorey)")
                elif rel.RelatingStructure.is_a('IfcBuildingStorey'):
                    self.info.append("✓ Products correctly contained in IfcBuildingStorey")
        
        self.info.append(f"✓ Validated {len(aggregates)} aggregation and {len(containments)} containment relationships")
    
    def print_results(self):
        """Print validation results"""
        print(f"\n{'='*70}")
        print("VALIDATION RESULTS")
        print(f"{'='*70}\n")
        
        if self.errors:
            print(f"❌ ERRORS ({len(self.errors)}):")
            for error in self.errors:
                print(f"   • {error}")
            print()
        
        if self.warnings:
            print(f"⚠️  WARNINGS ({len(self.warnings)}):")
            for warning in self.warnings:
                print(f"   • {warning}")
            print()
        
        if self.info:
            print(f"✓ PASSED CHECKS ({len(self.info)}):")
            for info in self.info:
                print(f"   {info}")
            print()
        
        print(f"{'='*70}")
        if self.errors:
            print("❌ VALIDATION FAILED")
            print(f"   {len(self.errors)} error(s), {len(self.warnings)} warning(s)")
        elif self.warnings:
            print("⚠️  VALIDATION PASSED WITH WARNINGS")
            print(f"   {len(self.warnings)} warning(s)")
        else:
            print("✅ VALIDATION PASSED")
            print("   All checks successful!")
        print(f"{'='*70}\n")


def main():
    if len(sys.argv) < 2:
        print("Usage: python validate_ifc.py <path_to_ifc_file>")
        print("\nExample:")
        print("  python validate_ifc.py Boscotek_prod-hd-cabinet_BTCS.700.560_CFG123_LEAD456.ifc")
        sys.exit(1)
    
    ifc_file = sys.argv[1]
    
    if not os.path.exists(ifc_file):
        print(f"ERROR: File not found: {ifc_file}")
        sys.exit(1)
    
    try:
        validator = IFCValidator(ifc_file)
        success = validator.validate_all()
        
        sys.exit(0 if success else 1)
    
    except Exception as e:
        print(f"\nERROR: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
