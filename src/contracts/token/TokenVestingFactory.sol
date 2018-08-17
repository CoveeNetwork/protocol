/*
    This file is part of the Covee Network protocol (smart contracts).
    
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

/**
 * @title TokenVestingFactory
 * @version 0.7
 * @author Validity Labs AG <info@validitylabs.org>
 * @author Covee Network AG <info@covee.network>
 * @dev A token holder factory to lock up tokens and release them at once after a certain time or gradually at a given rate. Then the tokens can be claimed.
 */
pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/TokenVesting.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "./CoveeToken.sol";

contract TokenVestingFactory {
 using SafeERC20 for CoveeToken;

 mapping(address => TokenVesting) public vestings;
 CoveeToken token;

 constructor(CoveeToken _token) public {
    token = _token;
 }

 function createAllInOneVesting(address _beneficiary, uint256 _releaseTime) external{
    require(vestings[_beneficiary] == address(0x0));
    TokenVesting v = new TokenVesting(_beneficiary, _releaseTime, 0, 0, false);
    vestings[_beneficiary] = v;
 }

 function createLinearVesting(address _beneficiary, uint256 _releaseTime, uint256 _duration) external{
     require(vestings[_beneficiary] == address(0x0));
     TokenVesting v = new TokenVesting(_beneficiary, _releaseTime, 0, _duration, false);
     vestings[_beneficiary] = v;
 }

}
