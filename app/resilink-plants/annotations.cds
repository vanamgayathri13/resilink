using ResilinkService as service from '../../srv/resilink-service';
annotate service.Plants with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : '{i18n>Name2}',
                Value : name,
            },
            {
                $Type : 'UI.DataField',
                Label : '{i18n>Location}',
                Value : location,
            },
            {
                $Type : 'UI.DataField',
                Label : '{i18n>Plannedcapacity}',
                Value : plannedCapacity,
            },
            {
                $Type : 'UI.DataField',
                Label : '{i18n>Availablecapacity}',
                Value : availableCapacity,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : '{i18n>GeneralInformation}',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : '{i18n>Name1}',
            Value : name,
        },
        {
            $Type : 'UI.DataField',
            Label : '{i18n>Location}',
            Value : location,
        },
        {
            $Type : 'UI.DataField',
            Label : '{i18n>Plannedcapacity}',
            Value : plannedCapacity,
        },
        {
            $Type : 'UI.DataField',
            Label : '{i18n>Availablecapacity}',
            Value : availableCapacity,
        },
    ],
);

