<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Http\Controllers\Api\ProjectController;

class ProjectMembersUnitTest extends TestCase
{
    public function test_controller_has_member_management_methods(): void
    {
        $this->assertTrue(method_exists(ProjectController::class, 'addMember'));
        $this->assertTrue(method_exists(ProjectController::class, 'removeMember'));
    }
}
