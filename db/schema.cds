namespace resilink;

using { cuid, managed } from '@sap/cds/common';

entity Plants : cuid, managed {
    name             : String(100);
    location         : String(100);
    plannedCapacity  : Integer;
    availableCapacity: Integer;
}

entity Suppliers : cuid, managed {
    name          : String(100);
    material      : String(100);
    capacity      : Integer;
    leadTimeDays  : Integer;
}

entity Inventory : cuid, managed {
    material : String(100);
    quantity : Integer;
    plant    : Association to Plants;
}

entity Disruptions : cuid, managed {
    title            : String(100);
    description      : String(500);
    affectedQuantity : Integer;
    status           : String(30);
    plant             : Association to Plants;
}