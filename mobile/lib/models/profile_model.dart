class CustomerRelationModel {
  final int relationId;
  final int deceasedId;
  final String deceasedCode;
  final String deceasedFullName;
  final String relationshipType;
  final bool isPrimaryContact;

  CustomerRelationModel({
    required this.relationId,
    required this.deceasedId,
    required this.deceasedCode,
    required this.deceasedFullName,
    required this.relationshipType,
    required this.isPrimaryContact,
  });

  factory CustomerRelationModel.fromJson(Map<String, dynamic> json) {
    return CustomerRelationModel(
      relationId: json['relation_id'] as int? ?? 0,
      deceasedId: json['deceased_id'] as int? ?? 0,
      deceasedCode: json['deceased_code'] as String? ?? '',
      deceasedFullName: json['deceased_full_name'] as String? ?? '',
      relationshipType: json['relationship_type'] as String? ?? '',
      isPrimaryContact: json['is_primary_contact'] as bool? ?? false,
    );
  }
}

class CustomerModel {
  final int customerId;
  final String customerCode;
  final String fullName;
  final String citizenId;
  final String phoneNumber;
  final String? email;
  final String address;
  final String? dateOfBirth;
  final List<CustomerRelationModel> relations;

  CustomerModel({
    required this.customerId,
    required this.customerCode,
    required this.fullName,
    required this.citizenId,
    required this.phoneNumber,
    this.email,
    required this.address,
    this.dateOfBirth,
    required this.relations,
  });

  factory CustomerModel.fromJson(Map<String, dynamic> json) {
    final rawRels = json['relations'] as List<dynamic>? ?? [];
    return CustomerModel(
      customerId: json['customer_id'] as int? ?? 0,
      customerCode: json['customer_code'] as String? ?? '',
      fullName: json['full_name'] as String? ?? '',
      citizenId: json['citizen_id'] as String? ?? '',
      phoneNumber: json['phone_number'] as String? ?? '',
      email: json['email'] as String?,
      address: json['address'] as String? ?? '',
      dateOfBirth: json['date_of_birth'] as String?,
      relations: rawRels
          .map((r) => CustomerRelationModel.fromJson(r as Map<String, dynamic>))
          .toList(),
    );
  }
}

class DeathCertificateModel {
  final int certId;
  final String certificateNumber;
  final String issuingAuthority;
  final String issueDate;
  final bool isVerified;
  final String? verifiedAt;
  final String? verifierName;
  final String? rejectionReason;

  DeathCertificateModel({
    required this.certId,
    required this.certificateNumber,
    required this.issuingAuthority,
    required this.issueDate,
    required this.isVerified,
    this.verifiedAt,
    this.verifierName,
    this.rejectionReason,
  });

  factory DeathCertificateModel.fromJson(Map<String, dynamic> json) {
    return DeathCertificateModel(
      certId: json['cert_id'] as int? ?? 0,
      certificateNumber: json['certificate_number'] as String? ?? '',
      issuingAuthority: json['issuing_authority'] as String? ?? '',
      issueDate: json['issue_date'] as String? ?? '',
      isVerified: json['is_verified'] as bool? ?? false,
      verifiedAt: json['verified_at'] as String?,
      verifierName: json['verifier_name'] as String?,
      rejectionReason: json['rejection_reason'] as String?,
    );
  }
}

class BurialSlotBriefModel {
  final int slotId;
  final int plotId;
  final int slotNumber;
  final String plotCode;
  final String zoneName;
  final String rowCode;
  final String status;
  final bool isKimTinh;

  BurialSlotBriefModel({
    required this.slotId,
    required this.plotId,
    required this.slotNumber,
    required this.plotCode,
    required this.zoneName,
    required this.rowCode,
    required this.status,
    required this.isKimTinh,
  });

  factory BurialSlotBriefModel.fromJson(Map<String, dynamic> json) {
    return BurialSlotBriefModel(
      slotId: json['slot_id'] as int? ?? 0,
      plotId: json['plot_id'] as int? ?? 0,
      slotNumber: json['slot_number'] as int? ?? 1,
      plotCode: json['plot_code'] as String? ?? '',
      zoneName: json['zone_name'] as String? ?? '',
      rowCode: json['row_code'] as String? ?? '',
      status: json['status'] as String? ?? '',
      isKimTinh: json['is_kim_tinh'] as bool? ?? false,
    );
  }
}

class DeceasedProfileModel {
  final int deceasedId;
  final String deceasedCode;
  final String fullName;
  final String gender;
  final String? dateOfBirth;
  final String dateOfDeath;
  final int? birthYear;
  final String birthDatePrecision;
  final String? hometown;
  final String? religion;
  final bool hasDeathCertificate;
  final DeathCertificateModel? deathCertificate;
  final BurialSlotBriefModel? burialSlot;

  DeceasedProfileModel({
    required this.deceasedId,
    required this.deceasedCode,
    required this.fullName,
    required this.gender,
    this.dateOfBirth,
    required this.dateOfDeath,
    this.birthYear,
    required this.birthDatePrecision,
    this.hometown,
    this.religion,
    required this.hasDeathCertificate,
    this.deathCertificate,
    this.burialSlot,
  });

  factory DeceasedProfileModel.fromJson(Map<String, dynamic> json) {
    return DeceasedProfileModel(
      deceasedId: json['deceased_id'] as int? ?? 0,
      deceasedCode: json['deceased_code'] as String? ?? '',
      fullName: json['full_name'] as String? ?? '',
      gender: json['gender'] as String? ?? 'UNKNOWN',
      dateOfBirth: json['date_of_birth'] as String?,
      dateOfDeath: json['date_of_death'] as String? ?? '',
      birthYear: json['birth_year'] as int?,
      birthDatePrecision: json['birth_date_precision'] as String? ?? 'EXACT',
      hometown: json['hometown'] as String?,
      religion: json['religion'] as String?,
      hasDeathCertificate: json['has_death_certificate'] as bool? ?? false,
      deathCertificate: json['death_certificate'] != null
          ? DeathCertificateModel.fromJson(json['death_certificate'] as Map<String, dynamic>)
          : null,
      burialSlot: json['burial_slot'] != null
          ? BurialSlotBriefModel.fromJson(json['burial_slot'] as Map<String, dynamic>)
          : null,
    );
  }
}

class MemorialLookupModel {
  final String deceasedCode;
  final String fullName;
  final int? yearOfBirth;
  final String dateOfDeath;
  final String? hometown;
  final String? zoneName;
  final String? rowCode;
  final String? plotCode;
  final int? slotNumber;
  final bool isKimTinh;
  final double? latitude;
  final double? longitude;
  final String? navigationGuidance;
  final String? mapsUrl;

  MemorialLookupModel({
    required this.deceasedCode,
    required this.fullName,
    this.yearOfBirth,
    required this.dateOfDeath,
    this.hometown,
    this.zoneName,
    this.rowCode,
    this.plotCode,
    this.slotNumber,
    required this.isKimTinh,
    this.latitude,
    this.longitude,
    this.navigationGuidance,
    this.mapsUrl,
  });

  factory MemorialLookupModel.fromJson(Map<String, dynamic> json) {
    return MemorialLookupModel(
      deceasedCode: json['deceased_code'] as String? ?? '',
      fullName: json['full_name'] as String? ?? '',
      yearOfBirth: json['year_of_birth'] as int?,
      dateOfDeath: json['date_of_death'] as String? ?? '',
      hometown: json['hometown'] as String?,
      zoneName: json['zone_name'] as String?,
      rowCode: json['row_code'] as String?,
      plotCode: json['plot_code'] as String?,
      slotNumber: json['slot_number'] as int?,
      isKimTinh: json['is_kim_tinh'] as bool? ?? false,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      navigationGuidance: json['navigation_guidance'] as String?,
      mapsUrl: json['maps_url'] as String?,
    );
  }
}
